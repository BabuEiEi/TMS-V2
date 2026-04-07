// 🔥 URL API ของพี่บาบู (ห้ามลบ/ห้ามแก้)
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

// ==========================================
// 1. ระบบยืนยันตัวตน (Auth) & นำทาง (Navigation)
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
  Swal.fire({ icon: 'success', title: 'ยินดีต้อนรับ', text: 'รหัส: ' + id, timer: 1500, showConfirmButton: false });
}

function logout() {
  localStorage.removeItem("tms_personal_id");
  document.getElementById("personalId").value = "";
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.add("d-none");
  document.getElementById("examSection").classList.add("d-none");
  document.getElementById("loginSection").classList.remove("d-none");
}

function showDashboard() {
  document.getElementById("loginSection").classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
}

function backToDashboard(currentSectionId) {
  document.getElementById(currentSectionId).classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
}

// ==========================================
// 2. ระบบลงเวลาอัจฉริยะ (Smart Attendance)
// ==========================================
async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  
  let userId = localStorage.getItem("tms_personal_id");
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  
  btnContainer.innerHTML = '<div class="text-center my-4"><div class="spinner-border text-info"></div><p class="mt-2 text-muted">กำลังตรวจสอบรอบเวลา...</p></div>';

  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: userId } })
    });
    let result = await response.json();

    if (result.status === 'success') {
      renderAttendanceButtons(result.schedule, result.userLogs);
    } else {
      btnContainer.innerHTML = `<div class="alert alert-danger rounded-4">${result.message}</div>`;
    }
  } catch (error) {
    btnContainer.innerHTML = '<div class="alert alert-danger rounded-4">ขาดการเชื่อมต่อกับเซิร์ฟเวอร์</div>';
  }
}

function renderAttendanceButtons(schedule, userLogs) {
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  btnContainer.innerHTML = ''; 
  
  if (schedule.length === 0) {
    btnContainer.innerHTML = '<div class="alert alert-warning text-center rounded-4">ไม่มีรอบการลงเวลาที่เปิดใช้งานในขณะนี้</div>';
    return;
  }

  let now = new Date();

  schedule.forEach(slot => {
    let key = slot.day_no + '_' + slot.slot_id;
    let loggedTime = userLogs[key];
    let btnClass = '', btnText = '', icon = '', isDisabled = false;

    if (loggedTime) {
      btnClass = 'btn-secondary opacity-75'; btnText = `ลงเวลาแล้ว (${loggedTime})`; icon = '✔️'; isDisabled = true;
    } else {
      let endDateTime = new Date(`${slot.date}T${slot.end_time}:00`);
      if (now > endDateTime) {
        btnClass = 'btn-warning text-dark'; btnText = `ลงเวลา: ${slot.slot_label} (สาย)`; icon = '⚠️';
      } else {
        btnClass = 'btn-success'; btnText = `ลงเวลา: ${slot.slot_label}`; icon = '📌';
      }
    }

    let btnHtml = `
      <button class="btn ${btnClass} w-100 mb-3 py-3 fw-bold text-start shadow-sm rounded-4" 
              ${isDisabled ? 'disabled' : ''} 
              onclick="${isDisabled ? '' : `submitRealAttendance('${slot.day_no}', '${slot.slot_id}', '${btnClass.includes('warning') ? 'สาย' : 'ตรงเวลา'}')`}">
        ${icon} ${btnText} <br>
        <small class="text-white-50 ms-4 fw-normal">วันที่ ${slot.day_no} | ${slot.start_time} - ${slot.end_time}</small>
      </button>
    `;
    btnContainer.innerHTML += btnHtml;
  });
}

async function submitRealAttendance(dayNo, timeSlot, timeStatus) {
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

  if (!swalResult.isConfirmed) return; 

  let safeNote = swalResult.value || ""; 
  let finalNote = safeNote.trim() ? `[${timeStatus}] ${safeNote.trim()}` : `[${timeStatus}]`;
  let userId = localStorage.getItem("tms_personal_id");
  let payloadData = { log_id: 'ATT-' + Date.now(), personal_id: userId, day_no: dayNo, time_slot: timeSlot, note: finalNote };

  Swal.fire({ title: 'กำลังบันทึกเวลา...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

  try {
    let response = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitAttendance', payload: payloadData }) });
    let result = await response.json();
    if (result.status === 'success') {
      Swal.fire('สำเร็จ!', 'บันทึกเวลาเรียบร้อยแล้ว', 'success').then(() => { openAttendanceForm(); });
    } else {
      Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
    }
  } catch (error) {
    Swal.fire('ขาดการเชื่อมต่อ', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
  }
}

// ==========================================
// 3. ระบบจัดการการสอบ (Assessment Engine V2.1)
// ==========================================
let globalExamData = null; 
let examCountdown = null; 

// ฟังก์ชันสลับตำแหน่ง (Fisher-Yates Shuffle)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function openExamForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("examSection").classList.remove("d-none");
  
  let userId = localStorage.getItem("tms_personal_id");
  let contentArea = document.getElementById("examContentArea");
  
  document.getElementById("btnSubmitExam").classList.add("d-none");
  document.getElementById("examTimerBadge").classList.add("d-none");
  document.getElementById("examTitleLabel").innerText = "";
  contentArea.innerHTML = '<div class="text-center my-5"><div class="spinner-border text-warning"></div><p class="mt-2">กำลังดึงชุดข้อสอบ...</p></div>';

  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getExamData', payload: { personal_id: userId } })
    });
    let result = await response.json();

    if (result.status === 'success') {
      globalExamData = result;
      renderExamStartScreen(); 
    } else if (result.status === 'taken') {
      contentArea.innerHTML = `<div class="alert alert-success text-center rounded-4"><h5 class="mb-0">${result.message}</h5></div>`;
    } else {
      contentArea.innerHTML = `<div class="alert alert-warning text-center rounded-4">${result.message}</div>`;
    }
  } catch (error) {
    contentArea.innerHTML = '<div class="alert alert-danger text-center rounded-4">ขาดการเชื่อมต่อกับเซิร์ฟเวอร์</div>';
  }
}

function renderExamStartScreen() {
  let contentArea = document.getElementById("examContentArea");
  let exam = globalExamData.activeExam;
  let qCount = globalExamData.questions.length;
  
  document.getElementById("examTitleLabel").innerText = exam.type + " TEST";

  let retakeMessage = '';
  let btnLabel = 'เริ่มทำข้อสอบ';
  let btnColor = 'btn-success';

  // 🚨 แจ้งเตือนการสอบซ่อม
  if (exam.isRetake) {
    let percent = ((exam.previousScore / exam.fullScore) * 100).toFixed(2);
    retakeMessage = `
      <div class="alert alert-warning mb-3 text-start">
        <b class="text-danger">⚠️ คุณสอบไม่ผ่านในครั้งแรก</b><br>
        คะแนนครั้งที่ 1: <b>${exam.previousScore}/${exam.fullScore}</b> (${percent}%)<br>
        เกณฑ์ผ่านคือ: <b>${exam.passingPercent}%</b><br>
        <i class="text-dark">คุณมีสิทธิ์สอบแก้ตัว (รอบที่ 2) ได้อีก 1 ครั้ง</i>
      </div>
    `;
    btnLabel = 'เริ่มสอบซ่อม (ครั้งที่ 2)';
    btnColor = 'btn-warning text-dark';
  }

  contentArea.innerHTML = `
    <div class="text-center my-5 p-4 bg-light rounded-4 border shadow-sm">
      <h4 class="text-primary fw-bold mb-3">คุณพร้อมหรือไม่?</h4>
      ${retakeMessage}
      <p class="text-muted fs-5">แบบทดสอบนี้มีทั้งหมด <b class="text-dark">${qCount}</b> ข้อ (ข้อละ 2 คะแนน)</p>
      <div class="alert alert-danger text-start small mx-auto" style="max-width: 400px;">
        <b>⚠️ คำเตือน:</b><br>ระบบจะเริ่มจับเวลาทันทีที่กดปุ่ม และมีการสลับข้อ/สลับตัวเลือก
      </div>
      <button class="btn btn-lg ${btnColor} mt-3 fw-bold px-5 rounded-pill shadow-sm" onclick="startExamTimer()">${btnLabel}</button>
    </div>
  `;
}

function startExamTimer() {
  let contentArea = document.getElementById("examContentArea");
  let questions = globalExamData.questions;
  
  // 🔀 สลับข้อสอบ
  shuffleArray(questions);

  let html = '';
  const thaiChoices = ['ก.', 'ข.', 'ค.', 'ง.']; 

  questions.forEach((q, index) => {
    let opts = [];
    if(q.options.A) opts.push({key: 'A', text: q.options.A});
    if(q.options.B) opts.push({key: 'B', text: q.options.B});
    if(q.options.C) opts.push({key: 'C', text: q.options.C});
    if(q.options.D) opts.push({key: 'D', text: q.options.D});
    
    // 🔀 สลับตัวเลือกภายในข้อ
    shuffleArray(opts);

    let optionsHtml = '';
    opts.forEach((opt, i) => {
      optionsHtml += `
        <div class="form-check mb-2">
          <input class="form-check-input border-secondary" type="radio" name="q_${q.id}" value="${opt.key}" id="q_${q.id}_${opt.key}"> 
          <label class="form-check-label" for="q_${q.id}_${opt.key}"><b class="text-primary">${thaiChoices[i]}</b> ${opt.text}</label>
        </div>`;
    });

    html += `
      <div class="mb-4 p-4 border rounded-4 bg-white exam-question shadow-sm">
        <p class="fw-bold mb-3 fs-5">${index + 1}. ${q.question}</p>
        ${optionsHtml}
      </div>
    `;
  });
  contentArea.innerHTML = html;
  
  document.getElementById("btnSubmitExam").classList.remove("d-none");
  document.getElementById("examTimerBadge").classList.remove("d-none");
  
  // ตั้งเวลา 30 นาที
  let timeRemaining = 30 * 60; 
  let display = document.getElementById("examTimeDisplay");

  examCountdown = setInterval(() => {
    let minutes = parseInt(timeRemaining / 60, 10);
    let seconds = parseInt(timeRemaining % 60, 10);
    display.textContent = (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);

    if (--timeRemaining < 0) {
      clearInterval(examCountdown);
      Swal.fire('หมดเวลา!', 'ระบบจะทำการส่งคำตอบของคุณอัตโนมัติ', 'warning').then(() => { submitRealExam(); });
    }
  }, 1000);
}

async function submitRealExam() {
  const confirmSubmit = await Swal.fire({
    title: 'ยืนยันการส่งคำตอบ?',
    text: "ตรวจสอบคำตอบให้เรียบร้อยก่อนส่งนะครับ",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#ffc107',
    cancelButtonColor: '#6c757d',
    confirmButtonText: '<span class="text-dark fw-bold">ใช่, ส่งคำตอบ</span>',
    cancelButtonText: 'กลับไปตรวจทาน'
  });

  if (!confirmSubmit.isConfirmed) return;

  clearInterval(examCountdown);

  // 1. ตรวจคำตอบ (ข้อละ 2 คะแนน)
  let questions = globalExamData.questions;
  let score = 0;
  let maxScore = questions.length * 2; 

  questions.forEach(q => {
    let selected = document.querySelector(`input[name="q_${q.id}"]:checked`);
    if (selected && selected.value === q.answer) {
      score += 2; 
    }
  });

  let userId = localStorage.getItem("tms_personal_id");
  let testType = globalExamData.activeExam.type;
  let payloadData = { 
    log_id: 'TEST-' + Date.now(), 
    personal_id: userId, 
    test_type: testType, 
    score: score, 
    max_score: maxScore 
  };

  Swal.fire({ title: 'กำลังบันทึกคะแนน...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

  try {
    let response = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitExam', payload: payloadData }) });
    let result = await response.json();

    if (result.status === 'success') {
      
      // 2. ลอจิกตรวจสอบการสอบซ่อม (Retake Logic)
      let percent = (score / maxScore) * 100;
      let passingGrade = globalExamData.activeExam.passingPercent || 80;
      let isFailedPostTest = (testType === 'POST' && percent < passingGrade);
      let canRetake = isFailedPostTest && !globalExamData.activeExam.isRetake;

      Swal.fire({
        icon: percent >= passingGrade ? 'success' : 'warning',
        title: percent >= passingGrade ? 'ยินดีด้วย! คุณสอบผ่าน' : 'เกือบผ่านแล้วครับ!',
        html: `
          <h4 class="mt-2">คะแนนของคุณ: <b class="${percent >= passingGrade ? 'text-success' : 'text-danger'} fs-2">${score} / ${maxScore}</b></h4>
          <p class="text-muted">คิดเป็นร้อยละ ${percent.toFixed(2)}% (เกณฑ์ผ่านคือ ${passingGrade}%)</p>
          ${canRetake ? '<p class="text-primary fw-bold">คุณมีสิทธิ์สอบแก้ตัวได้อีก 1 ครั้งครับ</p>' : ''}
        `,
        showCancelButton: canRetake,
        confirmButtonText: canRetake ? 'สอบซ่อมทันที' : 'กลับเมนูหลัก',
        cancelButtonText: 'กลับเมนูหลัก',
        confirmButtonColor: canRetake ? '#ffc107' : '#0d6efd',
        cancelButtonColor: '#6c757d'
      }).then((res) => {
        document.getElementById("examTimerBadge").classList.add("d-none");
        
        if (canRetake && res.isConfirmed) {
          openExamForm(); // โหลดหน้าสอบใหม่ทันที
        } else {
          backToDashboard('examSection');
        }
      });
    } else {
      Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
    }
  } catch (error) {
    Swal.fire('ขาดการเชื่อมต่อ', 'ไม่สามารถส่งข้อสอบได้', 'error');
  }
}

// ==========================================
// 4. ระบบจำลอง (Mockup) สำหรับปุ่มที่เหลือ
// ==========================================
async function testSubmit(actionType) {
  let userId = localStorage.getItem("tms_personal_id");
  let payloadData = { log_id: actionType + '-MOCK-' + Date.now(), personal_id: userId };
  
  if (actionType === 'submitProjectEval') {
    payloadData.target_id = 'PROJECT'; payloadData.answers = { "PRO-001": "ชาย", "PRO-002": "35-40 ปี" };
  } else if (actionType === 'submitSpeakerEval') {
    payloadData.target_id = 'SPK-834'; payloadData.answers = { "SPK-001": "5", "SPK-002": "4" };
  }

  Swal.fire({ title: 'กำลังทดสอบส่งข้อมูล...', didOpen: () => { Swal.showLoading(); }});

  try {
    let response = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: actionType, payload: payloadData }) });
    let result = await response.json();
    if (result.status === 'success') Swal.fire('สำเร็จ (โหมดทดสอบ)', 'ข้อมูลถูกส่งเข้าฐานข้อมูลแล้ว', 'success');
    else Swal.fire('ผิดพลาด', result.message, 'error');
  } catch (error) {
    Swal.fire('ขาดการเชื่อมต่อ', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
  }
}