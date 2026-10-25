from typing import List

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, require_hr_or_admin
from app.models.models import User
from app.schemas.payroll import PayrollRunOut, PayrollRunRequest, PayslipOut
from app.services.payroll_service import (
    finalize_payroll_run,
    generate_payroll_run,
    generate_payslip_pdf,
    get_payroll_run,
    get_payslip,
    list_payroll_runs,
)

router = APIRouter(prefix="/payroll", tags=["M6: Payroll & PDF"])


@router.post("/run", response_model=PayrollRunOut, status_code=201)
def run_payroll(
    payload: PayrollRunRequest,
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """Generate (or re-generate) a payroll run for a given month. HR/Admin only."""
    return generate_payroll_run(db, current_user, payload.month)


@router.get("/runs", response_model=List[PayrollRunOut])
def get_runs(
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """List all payroll runs. HR/Admin only."""
    return list_payroll_runs(db)


@router.get("/runs/{run_id}", response_model=PayrollRunOut)
def get_run(
    run_id: int,
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """Get a specific payroll run with all payslips. HR/Admin only."""
    return get_payroll_run(db, run_id)


@router.post("/runs/{run_id}/finalize")
def finalize_run(
    run_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Finalize a Draft payroll run. Admin only. Sends payslip emails."""
    return finalize_payroll_run(db, current_user, run_id)


@router.get("/payslips/{payslip_id}", response_model=PayslipOut)
def get_single_payslip(
    payslip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific payslip. Employees can only see their own."""
    return get_payslip(db, current_user, payslip_id)


@router.get("/payslips/{payslip_id}/pdf")
def download_payslip_pdf(
    payslip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download payslip as PDF. Employees can only download their own."""
    pdf_bytes = generate_payslip_pdf(db, current_user, payslip_id)
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=payslip_{payslip_id}.pdf"},
    )
