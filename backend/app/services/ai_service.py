import json
import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import AILog, Employee, User

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

def check_rate_limit(db: Session, user_id: int) -> None:
    """Raise 429 if user has made >= 20 AI requests in the last hour."""
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    count = (
        db.query(AILog)
        .filter(AILog.user_id == user_id, AILog.created_at >= one_hour_ago)
        .count()
    )
    if count >= 20:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded: maximum 20 AI requests per hour. Please try again later.",
        )


# ---------------------------------------------------------------------------
# Log AI interaction
# ---------------------------------------------------------------------------

def log_ai_interaction(
    db: Session, user_id: Optional[int], feature: str, prompt: str, response: str
) -> None:
    try:
        entry = AILog(
            user_id=user_id,
            feature=feature,
            prompt=prompt[:4000],
            response=response[:4000],
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        logger.warning("Failed to log AI interaction: %s", e)


# ---------------------------------------------------------------------------
# Azure OpenAI client
# ---------------------------------------------------------------------------

def get_ai_client():
    """Return AzureOpenAI client or None if not configured."""
    try:
        from openai import AzureOpenAI
        if not settings.AZURE_OPENAI_API_KEY or not settings.AZURE_OPENAI_ENDPOINT:
            return None
        # Extract base URL (strip any path)
        base_url = settings.AZURE_OPENAI_ENDPOINT.split("/openai")[0]
        client = AzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            azure_endpoint=base_url,
        )
        return client
    except Exception as e:
        logger.warning("Failed to create AzureOpenAI client: %s", e)
        return None


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

def build_system_prompt() -> str:
    return """You are the official Enterprise AI Assistant for HCM Lite.
You provide accurate assistance to Admin, HR professionals, and Employees based strictly on verified corporate data.

STRICT ACCESS & SECURITY RULES:
1. Compensation Privacy: When an Employee asks for another colleague or employee's salary or compensation details (e.g. 'What is [colleague]'s salary?'), you MUST POLITELY REFUSE. Explain that individual employee compensation records are strictly confidential and protected by corporate HR data privacy rules.
2. An Employee may ONLY view their own leave balance, their own attendance, and company-wide policies.
3. HR and Admin may query company-wide headcount, attendance rates, top late comers, leave summaries, and payroll totals.
4. When answering questions like 'Who came late most often this month?' or 'How many active employees are in Engineering?', use the corresponding tool and report exact numbers matching the official dashboard.

Company Leave Policies:
- Annual Leave: 14 days per year
- Sick Leave: 8 days per year
- Casual Leave: 10 days per year
- Unpaid Leave: Unlimited (no quota)
- Weekend days (Saturday, Sunday) are not counted as leave days
- Public holidays are not counted as leave days
- Sandwich rule: Overlap or exceeding balance returns error (HTTP 422)

Attendance Policies:
- Office hours start at 09:00 with 15 minutes grace period
- Arriving after 09:15 is recorded as 'late'
- Working less than 5 hours is recorded as 'half_day'
- Late penalty rule: Every 3 late arrivals result in a 0.5 day wage deduction
- Biometric camera check-in verifies facial frame and device GPS geofence (radius e.g. 150m)

Payroll Structure:
- Gross Salary = 1.5 × Basic Salary (composed of Basic + 40% HRA + 10% Medical allowance)
- Daily Rate = Gross Salary ÷ Total Working Days in month
- Deductions: absent days + unpaid leave days + (half_days × 0.5) + late arrival penalty (3 lates = 0.5 day)
- Income tax calculated per annual tax slabs (0% up to 600k, 5% up to 1.2M, etc.)

Always be concise, professional, and helpful. If data is not found in the database tools, honestly state that it is unavailable."""


# ---------------------------------------------------------------------------
# Tool definitions matching Saylani Hackathon Section 4
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_headcount",
            "description": "Get total active and probation headcount, optionally filtered by department name (HR/Admin only)",
            "parameters": {
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Optional department name filter"}
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_attendance_summary",
            "description": "Get attendance summary including present count, late count, and attendance rate for today or a specific month",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {"type": "string", "description": "Optional month in YYYY-MM format"}
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_late_comers",
            "description": "Get the top employees who arrived late most often this month (HR/Admin only)",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Number of top late comers to return, default 5"}
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_leave_summary",
            "description": "Get summary of approved or pending leaves today or YTD, broken down by leave type (HR/Admin only)",
            "parameters": {
                "type": "object",
                "properties": {
                    "leave_type": {"type": "string", "description": "Optional leave type filter"}
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_leave_balance",
            "description": "Get the currently logged-in employee's remaining leave balance (Annual, Sick, Casual)",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_payroll_summary",
            "description": "Get total payroll gross and net expenditure for the current or specified month (HR/Admin only)",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {"type": "string", "description": "Month in YYYY-MM format"}
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_employees",
            "description": "Search employee directory by name, code, or department (HR/Admin only)",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Name or employee code keyword"}
                },
                "required": ["query"],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Tool execution
# ---------------------------------------------------------------------------

def execute_tool(tool_name: str, tool_args: Dict[str, Any], db: Session, current_user: User) -> str:
    """Dispatch tool calls to actual service functions with RBAC."""
    try:
        from app.models.models import Attendance, Department, Employee, LeaveRequest, PayrollRun, Payslip
        from datetime import date
        today = date.today()
        month_str = today.strftime("%Y-%m")
        first_of_month = date(today.year, today.month, 1)

        if tool_name == "get_my_leave_balance":
            from app.services.leave_service import get_leave_balance
            emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
            if not emp:
                return json.dumps({"error": "No employee profile found for your account."})
            balance = get_leave_balance(db, emp.id)
            return json.dumps(balance.model_dump())

        elif tool_name == "get_headcount":
            dept_name = tool_args.get("department")
            query = db.query(Employee).filter(Employee.status.in_(["Active", "Probation"]))
            if dept_name:
                dept = db.query(Department).filter(Department.name.ilike(f"%{dept_name}%")).first()
                if dept:
                    query = query.filter(Employee.department_id == dept.id)
                else:
                    return json.dumps({"department": dept_name, "active_count": 0, "message": f"Department '{dept_name}' not found."})
            count = query.count()
            return json.dumps({"department": dept_name or "All Departments", "active_employees": count})

        elif tool_name == "get_attendance_summary":
            month = tool_args.get("month", month_str)
            if current_user.role == "Employee":
                emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
                if not emp:
                    return json.dumps({"error": "No employee profile found."})
                atts = db.query(Attendance).filter(Attendance.employee_id == emp.id, Attendance.date >= first_of_month).all()
                return json.dumps({
                    "month": month,
                    "present_count": sum(1 for a in atts if a.status in ("present", "late")),
                    "late_count": sum(1 for a in atts if a.status == "late"),
                    "half_day_count": sum(1 for a in atts if a.status == "half_day"),
                })
            else:
                total_emp = db.query(Employee).filter(Employee.status.in_(["Active", "Probation"])).count()
                present_today = db.query(Attendance).filter(Attendance.date == today, Attendance.status.in_(["present", "late"])).count()
                late_today = db.query(Attendance).filter(Attendance.date == today, Attendance.status == "late").count()
                rate = round((present_today / max(1, total_emp)) * 100, 1) if total_emp > 0 else 0.0
                return json.dumps({
                    "date": str(today),
                    "total_employees": total_emp,
                    "present_today": present_today,
                    "late_today": late_today,
                    "attendance_rate_percent": rate,
                })

        elif tool_name == "get_late_comers":
            if current_user.role not in ("HR", "Admin"):
                return json.dumps({"error": "Access denied: HR or Admin access required."})
            from sqlalchemy import func
            limit = tool_args.get("limit", 5)
            late_records = (
                db.query(Attendance.employee_id, func.count(Attendance.id))
                .filter(Attendance.date >= first_of_month, Attendance.status == "late")
                .group_by(Attendance.employee_id)
                .order_by(func.count(Attendance.id).desc())
                .limit(limit)
                .all()
            )
            results = []
            for emp_id, count in late_records:
                emp = db.query(Employee).filter(Employee.id == emp_id).first()
                if emp:
                    results.append({"employee_code": emp.employee_code, "full_name": emp.full_name, "late_count": count})
            return json.dumps({"month": month_str, "top_late_comers": results})

        elif tool_name == "get_leave_summary":
            if current_user.role not in ("HR", "Admin"):
                return json.dumps({"error": "Access denied: HR or Admin access required."})
            leaves_today = (
                db.query(LeaveRequest)
                .filter(LeaveRequest.status == "Approved", LeaveRequest.start_date <= today, LeaveRequest.end_date >= today)
                .all()
            )
            return json.dumps({
                "date": str(today),
                "total_on_leave_today": len(leaves_today),
                "breakdown": {
                    "Casual": sum(1 for l in leaves_today if l.leave_type == "Casual"),
                    "Sick": sum(1 for l in leaves_today if l.leave_type == "Sick"),
                    "Annual": sum(1 for l in leaves_today if l.leave_type == "Annual"),
                    "Unpaid": sum(1 for l in leaves_today if l.leave_type == "Unpaid"),
                },
            })

        elif tool_name == "get_payroll_summary":
            if current_user.role not in ("HR", "Admin"):
                return json.dumps({"error": "Access denied: HR or Admin access required."})
            from sqlalchemy import func
            month = tool_args.get("month", month_str)
            run = db.query(PayrollRun).filter(PayrollRun.month == month).first()
            if run:
                gross = db.query(func.sum(Payslip.gross_salary)).filter(Payslip.payroll_run_id == run.id).scalar() or 0.0
                net = db.query(func.sum(Payslip.net_salary)).filter(Payslip.payroll_run_id == run.id).scalar() or 0.0
                return json.dumps({"month": month, "status": run.status, "total_gross": float(gross), "total_net": float(net)})
            else:
                return json.dumps({"month": month, "status": "Not Generated", "message": f"Payroll for {month} has not been processed yet."})

        elif tool_name == "search_employees":
            if current_user.role not in ("HR", "Admin"):
                return json.dumps({"error": "Access denied: HR or Admin access required."})
            query = tool_args.get("query", "").strip()
            emps = db.query(Employee).filter(
                (Employee.full_name.ilike(f"%{query}%")) | (Employee.employee_code.ilike(f"%{query}%"))
            ).limit(10).all()
            return json.dumps([{
                "id": e.id,
                "code": e.employee_code,
                "name": e.full_name,
                "status": e.status,
                "department": e.department.name if e.department else None,
                "designation": e.designation.title if e.designation else None,
            } for e in emps])

        else:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})

    except Exception as e:
        logger.error("Tool execution error for %s: %s", tool_name, e)
        return json.dumps({"error": str(e)})

    except Exception as e:
        logger.error("Tool execution error for %s: %s", tool_name, e)
        return json.dumps({"error": str(e)})


# ---------------------------------------------------------------------------
# Main chat
# ---------------------------------------------------------------------------

def run_chat(db: Session, current_user: User, user_message: str) -> Dict[str, Any]:
    check_rate_limit(db, current_user.id)

    client = get_ai_client()
    if not client:
        return {
            "response": "AI service is not configured. Please contact your system administrator.",
            "tool_calls_made": [],
        }

    messages = [
        {"role": "system", "content": build_system_prompt()},
        {"role": "user", "content": user_message},
    ]

    tool_calls_made = []
    final_response = ""

    result_container = {}
    error_container = {}

    def call_ai():
        try:
            for _iteration in range(5):  # Max tool call iterations
                response = client.chat.completions.create(
                    model=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
                    messages=messages,
                    tools=TOOL_DEFINITIONS,
                    tool_choice="auto",
                )
                msg = response.choices[0].message

                if msg.tool_calls:
                    messages.append({"role": "assistant", "content": msg.content or "", "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                        }
                        for tc in msg.tool_calls
                    ]})
                    for tc in msg.tool_calls:
                        tool_result = execute_tool(
                            tc.function.name,
                            json.loads(tc.function.arguments),
                            db,
                            current_user,
                        )
                        tool_calls_made.append(tc.function.name)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": tool_result,
                        })
                else:
                    result_container["response"] = msg.content or "I could not generate a response."
                    break
        except Exception as e:
            error_container["error"] = str(e)

    thread = threading.Thread(target=call_ai)
    thread.start()
    thread.join(timeout=15)

    if thread.is_alive():
        final_response = "Request timed out. Please try again."
    elif "error" in error_container:
        logger.error("AI chat error: %s", error_container["error"])
        final_response = f"AI service error: {error_container['error']}"
    else:
        final_response = result_container.get("response", "No response generated.")

    log_ai_interaction(db, current_user.id, "chat", user_message, final_response)

    return {"response": final_response, "tool_calls_made": tool_calls_made}


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------

def run_dashboard_summary(db: Session, current_user: User, kpi_data: Dict[str, Any]) -> str:
    check_rate_limit(db, current_user.id)

    client = get_ai_client()
    if not client:
        return "AI service is not configured."

    kpi_text = json.dumps(kpi_data, indent=2)
    prompt = f"""You are an executive HR dashboard assistant. Based on the following KPI data, provide 5 concise, actionable bullet points highlighting key insights, risks, and recommendations for HR leadership.\n\nKPI Data:\n{kpi_text}"""

    response_text = ""
    try:
        resp = client.chat.completions.create(
            model=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": "You are a concise HR analytics assistant."},
                {"role": "user", "content": prompt},
            ],
        )
        response_text = resp.choices[0].message.content or ""
    except Exception as e:
        logger.error("Dashboard summary AI error: %s", e)
        response_text = f"Unable to generate summary: {str(e)}"

    log_ai_interaction(db, current_user.id, "dashboard_summary", kpi_text, response_text)
    return response_text


# ---------------------------------------------------------------------------
# Smart leave parser
# ---------------------------------------------------------------------------

def run_smart_leave(db: Session, current_user: User, natural_text: str, today_date: str) -> Dict[str, Any]:
    check_rate_limit(db, current_user.id)

    client = get_ai_client()
    if not client:
        return {"error": "AI service is not configured."}

    prompt = f"""Today's date: {today_date}

Parse the following leave request into a structured JSON object with these exact fields:
- leave_type: one of "Annual", "Sick", "Casual", "Unpaid"
- start_date: ISO format YYYY-MM-DD
- end_date: ISO format YYYY-MM-DD
- reason: brief reason string

Leave request: "{natural_text}"

Return ONLY valid JSON, no other text."""

    response_text = ""
    try:
        resp = client.chat.completions.create(
            model=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": "You are a leave request parser. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
        )
        response_text = resp.choices[0].message.content or "{}"
        # Strip markdown code blocks if present
        response_text = response_text.strip()
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            lines = [l for l in lines if not l.startswith("```")]
            response_text = "\n".join(lines).strip()
        result = json.loads(response_text)
    except json.JSONDecodeError:
        result = {"error": "Could not parse AI response as JSON.", "raw": response_text}
    except Exception as e:
        logger.error("Smart leave AI error: %s", e)
        result = {"error": str(e)}

    log_ai_interaction(db, current_user.id, "smart_leave", natural_text, str(result))
    return result
