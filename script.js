// 🔥 เชื่อมต่อกับ Backend (Google Apps Script) ของพี่บาบูเรียบร้อยครับ!
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

// จัดการหน้าจอตอนโหลดเว็บ
document.addEventListener("DOMContentLoaded", () => {
  let savedId = localStorage.getItem("tms_personal_id");
  if (savedId) {
    document.getElementById("personalId").value = savedId;
    showDashboard();
  }
});

// ระบบ Login
function login() {
  let id = document.getElementById("personalId").value.trim().toUpperCase();
  if (id === "") {
    Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสประจำตัวก่อนครับ', 'warning');
    return;
  }
  localStorage.setItem("tms_personal_id", id);
  showDashboard();
  Swal.fire({ 
    icon: 'success', 
    title: 'ยินดีต้อนรับ', 
    text: 'รหัสผู้ใช้งาน: ' + id, 
    timer: 1500, 
    showConfirmButton: false 
  });
}

// ระบบ Logout
function logout() {
  localStorage.removeItem("tms_personal_id");
  document.getElementById("personalId").value = "";
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("loginSection").classList.remove("d-none");
}

function showDashboard() {
  document.getElementById("loginSection").classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
}

// ฟังก์ชันยิงข้อมูลข้ามเซิร์ฟเวอร์ (จาก GitHub ไป Google)
async function testSubmit(actionType) {
  let userId = localStorage.getItem("tms_personal_id");
  
  // สร้างข้อมูลจำลอง (Mock Data) ตามประเภทปุ่มที่กดเพื่อทดสอบระบบ
  let payloadData = { log_id: actionType + '-' + Date.now(), personal_id: userId };
  
  if (actionType === 'submitExam') {
    payloadData.test_type = 'PRE'; 
    payloadData.score = 45; 
    payloadData.max_score = 50;
  } else if (actionType === 'submitAttendance') {
    payloadData.day_no = 1; 
    payloadData.time_slot = 'Morning'; 
    payloadData.note = 'เข้าเรียนตรงเวลา (ทดสอบจาก GitHub)';
  } else if (actionType === 'submitProjectEval') {
    payloadData.target_id = 'PROJECT'; 
    payloadData.answers = { "PRO-001": "ชาย", "PRO-002": "35-40 ปี" };
  } else if (actionType === 'submitSpeakerEval') {
    payloadData.target_id = 'SPK-834'; 
    payloadData.answers = { "SPK-001": "5", "SPK-002": "4" };
  }

  // โชว์หน้าต่าง Loading แบบสวยๆ
  Swal.fire({ 
    title: 'กำลังส่งข้อมูล...', 
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    // ยิงข้อมูลไปหา URL ของพี่บาบู
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: actionType, payload: payloadData })
    });

    let result = await response.json();

    // เช็คผลลัพธ์ที่ตอบกลับมาจาก Google Apps Script
    if (result.status === 'success') {
      Swal.fire('สำเร็จ', result.message, 'success');
    } else if (result.status === 'busy') {
      Swal.fire('คิวเต็ม', result.message, 'warning');
    } else {
      Swal.fire('ผิดพลาด', result.message, 'error');
    }
  } catch (error) {
    console.error("Fetch Error: ", error);
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ลองตรวจสอบอินเทอร์เน็ตดูนะครับ', 'error');
  }
}
