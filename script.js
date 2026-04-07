/**
 * PROJECT: TMS-V2
 * VERSION: 15.1 (Ultimate Consistency Edition)
 * AUTHOR: วิ (AI Assistant)
 * DESCRIPTION: ไฟล์จัดการ Logic หน้าบ้านทั้งหมด (Attendance, Exam, Survey)
 * [COMMENT: TAGS FOR SEARCH: #AUTH_LOGIC, #ATT_LOGIC, #EXAM_LOGIC, #SURVEY_LOGIC]
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// ============================================================
// [#AUTH_LOGIC]: ส่วนการจัดการระบบยืนยันตัวตนและการเปลี่ยนหน้าจอ
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  let savedId = localStorage.getItem("tms_personal_id");
  if (savedId) {
    document.getElementById("personalId").value = savedId;
    showDashboard();
  }
});

function login() {
  let idInput = document.getElementById("personalId");
  let id = idInput.value.trim().toUpperCase();
  
  if (id === "") {
    Swal.fire({
      icon: 'warning',
      title: 'แจ้งเตือน',
      text: 'กรุณากรอกรหัสประจำตัวก่อนครับ'
    });
    return;
  }
  
  localStorage.setItem("tms_personal_id", id);
  showDashboard();
  
  Swal.fire({
    icon: 'success',
    title: 'ยินดีต้อนรับ',
    text: 'เข้าสู่ระบบด้วยรหัส: ' + id,
    timer: 1500,
    showConfirmButton: false
  });
}

function logout() {
  localStorage.removeItem("tms_personal_id");
  location.reload();
}

function showDashboard() {
  document.getElementById("loginSection").classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
}

function backToDashboard(currentSectionId) {
  document.getElementById(currentSectionId).classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
  
  // ล้างสถานะกรณีถอยกลับจากหน้าสอบ
  isExamActive = false;
  clearInterval(examCountdown);
}


// ============================================================
// [#ATT_LOGIC]: ส่วนระบบลงเวลา (Smart Attendance)
// ============================================================

async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  
  let userId = localStorage.getItem("tms_personal_id");
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  
  btnContainer.innerHTML = `
    <div class="text-center my-4">
      <div class="spinner-border text-info"></div>
      <p class="mt-2 text-muted">กำลังตรวจสอบสถานะการลงเวลา...</p>
    </div>`;

  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'getAttendanceData', 
        payload: { personal_id: userId } 
      })
    });
    let result = await response.json();

    if (result.status === 'success') {
      renderAttendanceButtons(result.schedule, result.userLogs);
    } else {
      btnContainer.innerHTML = `
        <div class="alert alert-danger rounded-4 text-center">
          ${result.message}
        </div>`;
    }
  } catch (error) {
    btnContainer.innerHTML = `
      <div class="alert alert-danger rounded-4 text-center">
        ขาดการเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง
      </div>`;
  }
}

function renderAttendanceButtons(schedule, userLogs) {
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  btnContainer.innerHTML = ''; 
  
  if (schedule.length === 0) {
    btnContainer.innerHTML = `
      <div class="alert alert-warning text-center rounded-4 shadow-sm">
        ขณะนี้ไม่มีรอบการลงเวลาที่เปิดใช้งานในตารางครับ
      </div>`;
    return;
  }

  schedule.forEach(slot => {
    let key = slot.day_no + '_' + slot.slot_id;
    let loggedTime = userLogs[key];
    let btnHtml = '';

    if (loggedTime) {
      // แสดงสถานะลงเวลาสำเร็จ (ปุ่มเทา)
      btnHtml = `
        <div class="card mb-3 p-3 bg-light border-0 rounded-4 text-center opacity-75 shadow-sm">
          <div class="fw-bold text-secondary">✔️ ${slot.slot_label} บันทึกสำเร็จ</div>
          <small class="text-muted">บันทึกเมื่อ: ${loggedTime}</small>
        </div>`;
    } else {
      // แสดงปุ่มสำหรับรอบที่ยังไม่ได้ลง (ปุ่มเขียว)
      btnHtml = `
        <button class="btn btn-success w-100 mb-3 py-3 fw-bold rounded-4 shadow-sm" 
                onclick="submitRealAttendance('${slot.day_no}', '${slot.slot_id}', 'ตรงเวลา')">
          📌 ลงเวลา: ${slot.slot_label}<br>
          <small class="fw-normal opacity-75">
            วันที่ ${slot.day_no} | ช่วงเวลา ${slot.start_time} - ${slot.end_time}
          </small>
        </button>`;
    }
    btnContainer.innerHTML += btnHtml;
  });
}

async function submitRealAttendance(dayNo, timeSlot, timeStatus) {
  const swalResult = await Swal.fire({
    title: 'ยืนยันการบันทึกเวลา',
    text: 'คุณต้องการบันทึกเวลาเข้าร่วมอบรมใช่หรือไม่?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ใช่, บันทึกเวลา',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0dcaf0'
  });

  if (!swalResult.isConfirmed) return; 

  Swal.fire({ 
    title: 'กำลังส่งข้อมูล...', 
    allowOutsideClick: false, 
    didOpen: () => { Swal.showLoading(); }
  });

  let payloadData = {
    personal_id: localStorage.getItem("tms_personal_id"),
    day_no: dayNo,
    time_slot: timeSlot,
    note: `[${timeStatus}]`
  };

  try {
    let response = await fetch(GAS_API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ action: 'submitAttendance', payload: payloadData }) 
    });
    let result = await response.json();
    
    if (result.status === 'success') {
      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ!',
        text: 'บันทึกเวลาของคุณเรียบร้อยแล้วครับ',
        timer: 2000
      }).then(() => { 
        openAttendanceForm(); 
      });
    }
  } catch (error) {
    Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
  }
}


// ============================================================
// [#EXAM_LOGIC]: ส่วนระบบข้อสอบ (Ready Screen & Anti-Cheat)
// ============================================================

document.addEventListener('visibilitychange', () => {
  if (isExamActive && document.visibilityState === 'hidden') {
    Swal.fire({
      icon: 'warning',
      title: 'คำเตือน: ห้ามสลับหน้าจอ!',
      text: 'ระบบได้บันทึกพฤติกรรมการออกจากหน้าจอสอบไว้แล้ว กรุณากลับมาทำให้เสร็จสิ้นครับ',
      confirmButtonColor: '#d33'
    });
  }
});

async function openExamForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("examSection").classList.remove("d-none");
  
  let contentArea = document.getElementById("examContentArea");
  document.getElementById("btnSubmitExam").classList.add("d-none");
  document.getElementById("examTimerBadge").classList.add("d-none");
  document.getElementById("examTitleLabel").innerText = "";

  contentArea.innerHTML = `
    <div class="text-center p-5">
      <div class="spinner-border text-warning"></div>
      <p class="mt-2 text-muted">กำลังดึงข้อมูลชุดข้อสอบล่าสุดจากเซิร์ฟเวอร์...</p>
    </div>`;

  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'getExamData', 
        payload: { personal_id: localStorage.getItem("tms_personal_id") } 
      })
    });
    let result = await response.json();

    if (result.status === 'success') {
      globalExamData = result;
      document.getElementById("examTitleLabel").innerText = result.activeExam.type + " TEST";
      renderExamStartScreen(); // แสดงหน้ากากเตรียมพร้อมก่อนสอบ
    } else {
      contentArea.innerHTML = `
        <div class="alert alert-info text-center rounded-4 p-5 shadow-sm">
          <h5 class="fw-bold">${result.message}</h5>
          <p class="mb-0 text-muted">โปรดรอประกาศรอบการสอบจากคณะกรรมการอีกครั้ง</p>
        </div>`;
    }
  } catch (error) {
    contentArea.innerHTML = '<div class="alert alert-danger text-center">ผิดพลาดในการดึงข้อมูล</div>';
  }
}

function renderExamStartScreen() {
  let contentArea = document.getElementById("examContentArea");
  let exam = globalExamData.activeExam;
  let qCount = globalExamData.questions.length;
  
  contentArea.innerHTML = `
    <div class="text-center my-5 p-4 bg-light rounded-4 border shadow-sm fade-in">
      <h4 class="text-primary fw-bold mb-3">คุณพร้อมที่จะเริ่มทำแบบทดสอบหรือไม่?</h4>
      <p class="text-muted fs-5">แบบทดสอบ ${exam.type} มีจำนวนทั้งหมด <b class="text-dark">${qCount}</b> ข้อ</p>
      
      <div class="alert alert-info text-start small mx-auto" style="max-width: 480px;">
        <p class="fw-bold mb-2">📋 ข้อกำหนดการทำแบบทดสอบ:</p>
        <ul class="mb-0">
          <li>⏱️ ระบบจะเริ่มจับเวลา 30 นาทีทันทีที่ท่านกดปุ่ม</li>
          <li>💾 มีระบบบันทึกคำตอบอัตโนมัติ (Auto-Save)</li>
          <li>🚫 ห้ามสลับแท็บเบราว์เซอร์หรือสลับหน้าจอ (ระบบจะแจ้งเตือน)</li>
        </ul>
      </div>
      
      <button class="btn btn-lg btn-success mt-3 fw-bold px-5 rounded-pill shadow-sm" 
              onclick="startExamTimer()">
        เริ่มทำแบบทดสอบเดี๋ยวนี้
      </button>
    </div>
  `;
}

function startExamTimer() {
  isExamActive = true; 
  renderExamQuestions(); 
  startTimer(30 * 60); // นับถอยหลัง 30 นาที
  
  document.getElementById("btnSubmitExam").classList.remove("d-none");
  document.getElementById("examTimerBadge").classList.remove("d-none");
}

function renderExamQuestions() {
  let html = '';
  const thaiLabels = ['ก.', 'ข.', 'ค.', 'ง.'];
  
  // สลับลำดับข้อสอบแบบสุ่ม
  globalExamData.questions.sort(() => Math.random() - 0.5);

  globalExamData.questions.forEach((q, i) => {
    html += `
      <div class="card mb-4 p-4 border rounded-4 bg-white shadow-sm fade-in">
        <p class="fw-bold fs-5 mb-3">${i + 1}. ${q.question}</p>`;
    
    ['A','B','C','D'].forEach((opt, idx) => {
      html += `
        <div class="form-check mb-2">
          <input class="form-check-input border-secondary" type="radio" 
                 name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}">
          <label class="form-check-label w-100" for="q_${q.id}_${opt}" style="cursor:pointer;">
            <b class="text-primary">${thaiLabels[idx]}</b> ${globalExamData.questions[i].options[opt]}
          </label>
        </div>`;
    });
    
    html += `</div>`;
  });
  document.getElementById("examContentArea").innerHTML = html;
}

function startTimer(sec) {
  let display = document.getElementById("examTimeDisplay");
  
  examCountdown = setInterval(() => {
    let m = Math.floor(sec / 60);
    let s = sec % 60;
    
    display.innerText = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
    
    if (sec === 300) {
        Swal.fire({
            toast: true,
            position: 'top',
            icon: 'warning',
            title: 'เหลือเวลาอีก 5 นาทีสุดท้าย!',
            showConfirmButton: false,
            timer: 5000
        });
    }

    if (--sec < 0) { 
      clearInterval(examCountdown); 
      Swal.fire({
        title: 'หมดเวลา!',
        text: 'ระบบกำลังดำเนินการส่งคำตอบให้ท่านอัตโนมัติ',
        icon: 'warning',
        allowOutsideClick: false
      }).then(() => {
        submitRealExam(true); // บังคับส่งทันที
      });
    }
  }, 1000);
}

async function submitRealExam(isAuto = false) {
  if (!isAuto) {
    const confirm = await Swal.fire({
      title: 'ยืนยันการส่งคำตอบ?',
      text: 'เมื่อส่งแล้วจะไม่สามารถกลับมาแก้ไขได้อีกครับ',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ใช่, ส่งคำตอบ'
    });
    if (!confirm.isConfirmed) return;
  }

  isExamActive = false; 
  clearInterval(examCountdown);
  
  let score = 0;
  globalExamData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
    if (sel && sel.value === q.answer) {
        score += 2;
    }
  });

  Swal.fire({ title: 'กำลังประมวลผล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

  let payload = {
    personal_id: localStorage.getItem("tms_personal_id"),
    test_type: globalExamData.activeExam.type,
    score: score,
    max_score: globalExamData.questions.length * 2
  };

  try {
    await fetch(GAS_API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ action: 'submitExam', payload: payload }) 
    });
    
    Swal.fire({
      icon: 'success',
      title: 'ส่งคำตอบเรียบร้อยแล้ว',
      text: `คะแนนที่ท่านได้คือ ${score} คะแนน`
    }).then(() => {
      backToDashboard('examSection');
    });
  } catch (e) {
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลเพื่อบันทึกคะแนนได้', 'error');
  }
}


// ============================================================
// [#SURVEY_LOGIC]: ระบบประเมิน (Horizontal Rating Buttons)
// ============================================================

async function openSurveyForm(type) {
  currentSurveyType = type;
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("surveySection").classList.remove("d-none");
  
  let contentArea = document.getElementById("surveyContentArea");
  document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
  
  contentArea.innerHTML = `
    <div class="text-center p-5">
      <div class="spinner-border text-success"></div>
      <p class="mt-2 text-muted">กำลังเตรียมแบบประเมินผลออนไลน์...</p>
    </div>`;
  
  document.getElementById("btnSubmitSurvey").classList.add("d-none");

  try {
    let response = await fetch(GAS_API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ 
        action: 'getSurveyData', 
        payload: { survey_type: type } 
      }) 
    });
    globalSurveyData = await response.json();
    
    if (type === 'SPEAKER_SURVEY') { 
        renderSpeakerSelect(); 
        contentArea.innerHTML = `
          <div class="text-center text-muted p-5 bg-white rounded-4 border border-dashed">
            โปรดคลิกเลือกรายชื่อวิทยากรที่ช่อง "กรุณาเลือกวิทยากร" ด้านบน
          </div>`;
    } else { 
        document.getElementById("speakerSelectionArea").classList.add("d-none");
        renderSurveyQuestions(); 
        document.getElementById("btnSubmitSurvey").classList.remove("d-none"); 
    }
  } catch (e) {
    contentArea.innerHTML = '<div class="alert alert-danger text-center">ไม่สามารถโหลดข้อมูลแบบประเมินได้</div>';
  }
}

function renderSpeakerSelect() {
  let select = document.getElementById("speakerSelect");
  select.innerHTML = '<option value="" disabled selected>-- คลิกเพื่อเลือกรายชื่อวิทยากร --</option>';
  
  if (!globalSurveyData.speakers || globalSurveyData.speakers.length === 0) {
    document.getElementById("surveyContentArea").innerHTML = `
      <div class="alert alert-warning text-center rounded-4 shadow-sm">
        ยังไม่มีรอบเปิดประเมินวิทยากรตามตารางเวลาในปัจจุบันครับ
      </div>`;
    return;
  }
  
  globalSurveyData.speakers.forEach(spk => {
    select.innerHTML += `<option value="${spk.id}">${spk.name} (หัวข้อ: ${spk.topic})</option>`;
  });
  
  document.getElementById("speakerSelectionArea").classList.remove("d-none");
  
  select.onchange = () => { 
    renderSurveyQuestions(); 
    document.getElementById("btnSubmitSurvey").classList.remove("d-none"); 
  };
}

function renderSurveyQuestions() {
  let html = '';
  let grouped = {};
  
  globalSurveyData.questions.forEach(q => {
    if(!grouped[q.category]) {
        grouped[q.category] = [];
    }
    grouped[q.category].push(q);
  });

  Object.keys(grouped).forEach(cat => {
    html += `
      <h6 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2 border-3">
        ${cat}
      </h6>`;
      
    grouped[cat].forEach(q => {
      let optsHtml = '';
      
      if (q.options[0] === 'TEXT') {
        optsHtml = `<textarea class="form-control" name="sq_${q.id}" rows="3" placeholder="ระบุความคิดเห็นหรือข้อเสนอแนะของท่าน..."></textarea>`;
      } else {
        // วาด Rating แบบปุ่มกลมเรียงตามแนวนอน (UX Update)
        optsHtml = `<div class="rating-container">`;
        q.options.forEach(opt => {
          optsHtml += `
            <div class="rating-item">
              <input type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}">
              <label class="rating-label shadow-sm" for="sq_${q.id}_${opt}">${opt}</label>
            </div>`;
        });
        optsHtml += `</div>
          <div class="d-flex justify-content-between max-width-450 px-1 mb-2">
            <small class="text-muted">มากที่สุด</small>
            <small class="text-muted">น้อยที่สุด</small>
          </div>`;
      }
      
      html += `
        <div class="card p-4 mb-3 border-0 shadow-sm rounded-4 border-start border-4 border-info fade-in">
          <p class="fw-bold mb-2 fs-5 text-dark">${q.question}</p>
          ${optsHtml}
        </div>`;
    });
  });
  document.getElementById("surveyContentArea").innerHTML = html;
}

async function submitRealSurvey() {
  let answers = {};
  let isAllAnswered = true;
  
  globalSurveyData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="sq_${q.id}"]:checked`) || 
              document.querySelector(`textarea[name="sq_${q.id}"]`);
              
    if (sel && sel.value.trim() !== "") {
        answers[q.id] = sel.value;
    } else {
        isAllAnswered = false;
    }
  });

  if (!isAllAnswered) {
    Swal.fire('ข้อมูลไม่ครบ', 'กรุณาตอบคำถามในแบบประเมินให้ครบทุกข้อครับ', 'warning');
    return;
  }
  
  let speakerId = document.getElementById("speakerSelect").value;
  let target = currentSurveyType === 'PROJECT_SURVEY' ? 'PROJECT' : speakerId;
  
  Swal.fire({ title: 'กำลังบันทึกผล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
  
  try {
    let action = currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval';
    let response = await fetch(GAS_API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ 
        action: action, 
        payload: { 
          personal_id: localStorage.getItem("tms_personal_id"), 
          answers: answers, 
          target_id: target 
        } 
      }) 
    });
    let result = await response.json();
    
    if (result.status === 'success') {
      Swal.fire('บันทึกสำเร็จ', 'ขอบคุณสำหรับข้อมูลประเมินที่มีค่าของท่านครับ', 'success').then(() => {
        backToDashboard('surveySection');
      });
    }
  } catch (e) {
    Swal.fire('ผิดพลาด', 'ไม่สามารถส่งข้อมูลประเมินได้ในขณะนี้', 'error');
  }
}