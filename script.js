// 🔥 URL API ของพี่บาบู (เชื่อมต่อฐานข้อมูล GAS)
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

// ==========================================
// 1. ระบบยืนยันตัวตน (Authentication)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
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

function backToDashboard(currentSectionId) {
  document.getElementById(currentSectionId).classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
}

// ==========================================
// 3. ระบบส่งข้อมูลจริง: แบบฟอร์มลงเวลา (Smart Buttons)
// ==========================================

async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  
  let userId = localStorage.getItem("tms_personal_id");
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  
  // โชว์โหลดดิ้งรอข้อมูลจาก GAS
  btnContainer.innerHTML = '<div class="text-center"><div class="spinner-border text-info"></div><p class="mt-2 text-muted">กำลังตรวจสอบรอบเวลา...</p></div>';

  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: userId } })
    });
    let result = await response.json();

    if (result.status === 'success') {
      renderAttendanceButtons(result.schedule, result.userLogs);
    } else {
      btnContainer.innerHTML = `<div class="alert alert-danger">ผิดพลาด: ${result.message}</div>`;
    }
  } catch (error) {
    btnContainer.innerHTML = '<div class="alert alert-danger">ขาดการเชื่อมต่อกับเซิร์ฟเวอร์</div>';
  }
}

function renderAttendanceButtons(schedule, userLogs) {
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  btnContainer.innerHTML = ''; // ล้างของเดิม
  
  if (schedule.length === 0) {
    btnContainer.innerHTML = '<div class="alert alert-warning text-center">ไม่มีรอบการลงเวลาที่เปิดใช้งานในขณะนี้</div>';
    return;
  }

  let now = new Date();

  schedule.forEach(slot => {
    let key = slot.day_no + '_' + slot.slot_id;
    let loggedTime = userLogs[key];
    
    let btnClass = '';
    let btnText = '';
    let icon = '';
    let isDisabled = false;

    // เช็คว่าลงเวลาไปหรือยัง
    if (loggedTime) {
      btnClass = 'btn-secondary opacity-75'; // สีเทา
      btnText = `ลงเวลาแล้ว (${loggedTime})`;
      icon = '✔️';
      isDisabled = true;
    } else {
      // คำนวณเวลาว่า "สาย" หรือไม่
      let endDateTime = new Date(`${slot.date}T${slot.end_time}:00`);
      
      if (now > endDateTime) {
        btnClass = 'btn-warning text-dark'; // สีเหลือง (เกินเวลา)
        btnText = `ลงเวลา: ${slot.slot_label} (สาย)`;
        icon = '⚠️';
      } else {
        btnClass = 'btn-success'; // สีเขียว (ในเวลา)
        btnText = `ลงเวลา: ${slot.slot_label}`;
        icon = '📌';
      }
    }

    // สร้างปุ่ม
    let btnHtml = `
      <button class="btn ${btnClass} w-100 mb-2 py-3 fw-bold text-start shadow-sm" 
              ${isDisabled ? 'disabled' : ''} 
              onclick="${isDisabled ? '' : `submitRealAttendance('${slot.day_no}', '${slot.slot_id}', '${btnClass.includes('warning') ? 'สาย' : 'ตรงเวลา'}')`}">
        ${icon} ${btnText} <br>
        <small class="text-white-50 ms-4 fw-normal">วันที่ ${slot.day_no} | ${slot.start_time} - ${slot.end_time}</small>
      </button>
    `;
    btnContainer.innerHTML += btnHtml;
  });
}

// 🔥 ฟังก์ชันที่แก้บั๊กเรื่อง Pop-up กดไม่ไปครับ
async function submitRealAttendance(dayNo, timeSlot, timeStatus) {
  // 1. เรียก Pop-up
  const swalResult = await Swal.fire({
    title: 'หมายเหตุการลงเวลา',
    text: 'ระบุหมายเหตุเพิ่มเติม (ถ้ามี)',
    input: 'text',
    inputPlaceholder: 'เช่น ลากิจ, ลาป่วย (เว้นว่างได้)',
    showCancelButton: true,
    confirmButtonText: 'บันทึกเวลา',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0dcaf0',
    cancelButtonColor: '#6c757d'
  });

  // 2. เช็คว่าผู้ใช้กด "ยกเลิก" หรือไม่ (ใช้ .isConfirmed จะชัวร์ที่สุด)
  if (!swalResult.isConfirmed) {
    return; // หยุดทำงานถ้ากดปิดหรือกดยกเลิก
  }

  // 3. เซฟตี้ดักค่าว่าง (ป้องกัน Error)
  let safeNote = swalResult.value || ""; 
  let finalNote = safeNote.trim() ? `[${timeStatus}] ${safeNote.trim()}` : `[${timeStatus}]`;

  // 4. เตรียมข้อมูลส่งขึ้นเซิร์ฟเวอร์
  let userId = localStorage.getItem("tms_personal_id");
  let payloadData = {
    log_id: 'ATT-' + Date.now(),
    personal_id: userId,
    day_no: dayNo,
    time_slot: timeSlot,
    note: finalNote
  };

  // 5. โชว์สถานะกำลังโหลด
  Swal.fire({ 
    title: 'กำลังบันทึกเวลา...', 
    allowOutsideClick: false, 
    didOpen: () => { Swal.showLoading(); }
  });

  // 6. ส่งข้อมูล
  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'submitAttendance', payload: payloadData })
    });
    let result = await response.json();

    if (result.status === 'success') {
      Swal.fire('สำเร็จ!', 'บันทึกเวลาเรียบร้อยแล้ว', 'success').then(() => {
        openAttendanceForm(); // รีเฟรชปุ่มให้กลายเป็นสีเทา
      });
    } else {
      Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
    }
  } catch (error) {
    console.error(error);
    Swal.fire('ขาดการเชื่อมต่อ', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
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