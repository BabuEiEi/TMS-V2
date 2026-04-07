// 🔥 URL API ของพี่บาบู (เชื่อมต่อฐานข้อมูล GAS)
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

// ==========================================
// 1. ระบบยืนยันตัวตน (Authentication)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // ตรวจสอบว่าเคยเข้าสู่ระบบไว้หรือไม่
  let savedId = localStorage.getItem("tms_personal_id");
  if (savedId) {
    document.getElementById("personalId").value = savedId;
    showDashboard();
  }
});

function login() {
  let id = document.getElementById("personalId").value.trim().toUpperCase();
  if (id === "") {
    Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสประจำตัวก่อนครับ', 'warning');
    return;
  }
  // บันทึกรหัสลงในเบราว์เซอร์
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

function logout() {
  localStorage.removeItem("tms_personal_id");
  document.getElementById("personalId").value = "";
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.add("d-none");
  document.getElementById("loginSection").classList.remove("d-none");
}

// ==========================================
// 2. ระบบนำทางหน้าจอ (Navigation)
// ==========================================
function showDashboard() {
  document.getElementById("loginSection").classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
}

function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
}

function backToDashboard(currentSectionId) {
  document.getElementById(currentSectionId).classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
}

// ==========================================
// 3. ระบบส่งข้อมูลจริง: แบบฟอร์มลงเวลา (Production)
// ==========================================
async function submitRealAttendance() {
  let userId = localStorage.getItem("tms_personal_id");
  let dayNo = document.getElementById("attDay").value;
  let timeSlot = document.getElementById("attSlot").value;
  let note = document.getElementById("attNote").value.trim();

  // จัดเตรียมข้อมูลก่อนส่ง
  let payloadData = {
    log_id: 'ATT-' + Date.now(),
    personal_id: userId,
    day_no: dayNo,
    time_slot: timeSlot,
    note: note
  };

  Swal.fire({ 
    title: 'กำลังบันทึกเวลา...', 
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'submitAttendance', payload: payloadData })
    });

    let result = await response.json();

    if (result.status === 'success') {
      Swal.fire('สำเร็จ!', 'บันทึกเวลาเรียบร้อยแล้ว', 'success').then(() => {
        document.getElementById("attNote").value = ""; // ล้างค่าฟิลด์หมายเหตุ
        backToDashboard('attendanceSection'); // ดีดกลับหน้าหลัก
      });
    } else if (result.status === 'busy') {
      Swal.fire('คิวระบบเต็มชั่วคราว', result.message, 'warning');
    } else {
      Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
    }
  } catch (error) {
    console.error("Fetch Error: ", error);
    Swal.fire('ขาดการเชื่อมต่อ', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ โปรดตรวจสอบอินเทอร์เน็ตครับ', 'error');
  }
}

// ==========================================
// 4. ระบบจำลอง: สำหรับปุ่มที่กำลังพัฒนา (Mockup API)
// ==========================================
async function testSubmit(actionType) {
  let userId = localStorage.getItem("tms_personal_id");
  let payloadData = { log_id: actionType + '-MOCK-' + Date.now(), personal_id: userId };
  
  if (actionType === 'submitExam') {
    payloadData.test_type = 'PRE'; payloadData.score = 45; payloadData.max_score = 50;
  } else if (actionType === 'submitProjectEval') {
    payloadData.target_id = 'PROJECT'; payloadData.answers = { "PRO-001": "ชาย", "PRO-002": "35-40 ปี" };
  } else if (actionType === 'submitSpeakerEval') {
    payloadData.target_id = 'SPK-834'; payloadData.answers = { "SPK-001": "5", "SPK-002": "4" };
  }

  Swal.fire({ title: 'กำลังทดสอบส่งข้อมูล...', didOpen: () => { Swal.showLoading(); }});

  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: actionType, payload: payloadData })
    });
    
    let result = await response.json();

    if (result.status === 'success') {
      Swal.fire('สำเร็จ (โหมดทดสอบ)', 'ข้อมูลจำลองถูกส่งเข้าฐานข้อมูลแล้ว', 'success');
    } else {
      Swal.fire('ผิดพลาด', result.message, 'error');
    }
  } catch (error) {
    Swal.fire('ขาดการเชื่อมต่อ', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
  }
}