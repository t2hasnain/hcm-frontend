import base64
import json
import logging
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

IMGBB_API_KEY = "ff5602c6948eed55e522fbb11947eb95"
IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload"


def upload_to_imgbb(file_bytes: bytes, file_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Upload an image binary buffer to ImgBB using API v1.
    Returns dictionary with url, display_url, thumb_url, and delete_url.
    """
    try:
        base64_image = base64.b64encode(file_bytes).decode("utf-8")
        post_data = {
            "key": IMGBB_API_KEY,
            "image": base64_image,
        }
        if file_name:
            post_data["name"] = file_name

        encoded_data = urllib.parse.urlencode(post_data).encode("utf-8")
        req = urllib.request.Request(
            IMGBB_UPLOAD_URL,
            data=encoded_data,
            headers={"User-Agent": "HCM-Lite-Enterprise/1.0"},
        )

        with urllib.request.urlopen(req, timeout=30) as response:
            res_json = json.loads(response.read().decode("utf-8"))

        if not res_json.get("success"):
            error_msg = res_json.get("error", {}).get("message", "ImgBB upload failed")
            logger.error("ImgBB upload error: %s", error_msg)
            raise RuntimeError(error_msg)

        data = res_json.get("data", {})
        return {
            "success": True,
            "url": data.get("url"),
            "display_url": data.get("display_url"),
            "thumb_url": data.get("thumb", {}).get("url"),
            "delete_url": data.get("delete_url"),
            "width": data.get("width"),
            "height": data.get("height"),
        }

    except Exception as e:
        logger.error("Failed to upload image to ImgBB: %s", e)
        raise RuntimeError(f"ImgBB upload failed: {str(e)}")
