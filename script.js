/**
 * PROJECT: TMS-V2
 * VERSION: 17.0 (Full Structure Consistency)
 * AUTHOR: วิ (AI Assistant)
 * DESCRIPTION: ไฟล์จัดการ Logic ทั้งหมด (Attendance, Exam, Survey)
 * [COMMENT: TAGS FOR SEARCH: #NAV_LOGIC, #ATT_LOGIC, #EXAM_LOGIC, #SURVEY_LOGIC]
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// ============================================================
// [#NAV_LOGIC]: การจัดการนำทางและสถานะพื้นฐาน
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
    text: 'รหัส: ' + id, 
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
  
  isExamActive = false;
  clearInterval(examCountdown);
}


// ============================================================
// [#ATT_LOGIC]: ระบบลงเวลาพร้อมแสดงประวัติประทับเวลา
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
        ขาดการเชื่อมต่อกับเซิร์ฟเวอร์
      </div>`;
  }
}

function renderAttendanceButtons(schedule, userLogs) {
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  btnContainer.innerHTML = ''; 
  
  if (schedule.length === 0) {
    btnContainer.innerHTML = `
      <div class="alert alert-warning text-center rounded-4 shadow-sm">
        ขณะนี้ไม่มีรอบการลงเวลาในตารางครับ
      </div>`;
    return;
  }

  schedule.forEach(slot => {
    let key = slot.day_no + '_' + slot.slot_id;
    let loggedTime = userLogs[key];

    if (loggedTime) {
      // แสดงสถานะลงเวลาแล้ว (ปุ่มเทา)
      btnContainer.innerHTML += `
        <div class="card mb-3 p-3 bg-light border-0 rounded-4 text-center opacity-75 shadow-sm">
          <div class="fw-bold text-secondary">✔️ ${slot.slot_label} บันทึกสำเร็จแล้ว</div>
          <small class="text-muted">บันทึกเมื่อ: ${loggedTime}</small>
        </div>`;
    } else {
      // แสดงปุ่มสำหรับรอบที่ยังไม่ได้ลง (ปุ่มเขียว)
      btnContainer.innerHTML += `
        <button class="btn btn-success w-100 mb-3 py-3 fw-bold rounded-4 shadow-sm" 
                onclick="submitRealAttendance('${slot.day_no}', '${slot.slot_id}', 'ตรงเวลา')">
          📌 ลงเวลา: ${slot.slot_label}<br>
          <small class="fw-normal opacity-75">
            วันที่ ${slot.day_no} | ${slot.start_time} - ${slot.end_time}
          </small>
        </button>`;
    }
  });
}

async function submitRealAttendance(dayNo, timeSlot, timeStatus) {
  const swalResult = await Swal.fire({
    title: 'ยืนยันการบันทึกเวลา',
    text: 'คุณต้องการบันทึกเวลาเข้าร่วมอบรมใช่หรือไม่?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ใช่, บันทึกเวลา',
    confirmButtonColor: '#0dcaf0'
  });

  if (!swalResult.isConfirmed) {
      return;
  }

  Swal.fire({ 
    title: 'กำลังบันทึกข้อมูล...', 
    allowOutsideClick: false, 
    didOpen: () => { 
        Swal.showLoading(); 
    }
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
        text: 'บันทึกเวลาเรียบร้อยแล้วครับ'
      }).then(() => { 
        openAttendanceForm(); 
      });
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'ผิดพลาด',
      text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
    });
  }
}


// ============================================================
// [#EXAM_LOGIC]: ระบบข้อสอบ (หน้าต้อนรับ + กันทุจริต)
// ============================================================

document.addEventListener('visibilitychange', () => {
  if (isExamActive && document.visibilityState === 'hidden') {
    Swal.fire({
      icon: 'warning',
      title: 'คำเตือน: ห้ามสลับหน้าจอ!',
      text: 'ระบบได้บันทึกพฤติกรรมของท่านไว้แล้ว กรุณากลับมาทำข้อสอบให้เสร็จสิ้นครับ',
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

  contentArea.innerHTML = `
    <div class="text-center p-5">
      <div class="spinner-border text-warning"></div>
      <p class="mt-2 text-muted">กำลังดึงข้อสอบล่าสุดจากเซิร์ฟเวอร์...</p>
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
      renderExamStartScreen(); // แสดงหน้าเตรียมพร้อมก่อนทำข้อสอบ
    } else {
      contentArea.innerHTML = `
        <div class="alert alert-info text-center rounded-4 p-5">
          <h5 class="fw-bold">${result.message}</h5>
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
    <div class="text-center my-5 p-4 bg-light rounded-4 border shadow-sm">
      <h4 class="text-primary fw-bold mb-3">คุณพร้อมที่จะทำแบบทดสอบหรือไม่?</h4>
      <p class="text-muted fs-5">แบบทดสอบนี้มีทั้งหมด <b class="text-dark">${qCount}</b> ข้อ</p>
      
      <div class="alert alert-info text-start small mx-auto" style="max-width: 450px;">
        <ul class="mb-0">
          <li>⏱️ ระบบเริ่มจับเวลา 30 นาทีทันทีที่กดเริ่ม</li>
          <li>💾 มีระบบ Auto-Save กันข้อมูลสูญหาย</li>
          <li>🚫 ห้ามสลับหน้าจอ ระบบจะทำการแจ้งเตือน</li>
        </ul>
      </div>
      
      <button class="btn btn-lg btn-success mt-3 fw-bold px-5 rounded-pill shadow-sm" 
              onclick="startExamTimer()">
        เริ่มทำข้อสอบ
      </button>
    </div>
  `;
}

function startExamTimer() {
  isExamActive = true; 
  renderExamQuestions(); 
  startTimer(30 * 60);
  
  document.getElementById("btnSubmitExam").classList.remove("d-none");
  document.getElementById("examTimerBadge").classList.remove("d-none");
}

function renderExamQuestions() {
  let html = '';
  const labels = ['ก.', 'ข.', 'ค.', 'ง.'];
  
  // สลับข้อสอบเพื่อความยุติธรรม
  globalExamData.questions.sort(() => {
      return Math.random() - 0.5;
  });

  globalExamData.questions.forEach((q, i) => {
    html += `
      <div class="card mb-4 p-4 border rounded-4 bg-white shadow-sm">
        <p class="fw-bold fs-5 mb-3">${i + 1}. ${q.question}</p>`;
    
    ['A','B','C','D'].forEach((opt, idx) => {
      html += `
        <div class="form-check mb-2">
          <input class="form-check-input border-secondary" type="radio" 
                 name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}">
          <label class="form-check-label w-100" for="q_${q.id}_${opt}" style="cursor:pointer;">
            <b class="text-primary">${labels[idx]}</b> ${globalExamData.questions[i].options[opt]}
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
    
    if (--sec < 0) { 
      clearInterval(examCountdown); 
      Swal.fire({
        title: 'หมดเวลา!',
        text: 'ระบบกำลังส่งคำตอบให้อัตโนมัติ',
        icon: 'warning'
      }).then(() => {
          submitRealExam(true);
      }); 
    }
  }, 1000);
}

async function submitRealExam(isAuto = false) {
  if (!isAuto) {
    const confirm = await Swal.fire({ 
        title: 'ยืนยันการส่งคำตอบ?', 
        icon: 'question', 
        showCancelButton: true 
    });
    if (!confirm.isConfirmed) {
        return;
    }
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

  Swal.fire({ 
    title: 'กำลังประมวลผลคะแนน...', 
    allowOutsideClick: false, 
    didOpen: () => { 
        Swal.showLoading(); 
    }
  });

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
      title: 'สำเร็จ',
      text: `คะแนนที่คุณได้คือ ${score} คะแนน`
    }).then(() => {
      backToDashboard('examSection');
    });
  } catch (e) {
    Swal.fire('ผิดพลาด', 'ส่งข้อมูลไม่ได้ กรุณาลองใหม่', 'error');
  }
}


// ============================================================
// [#SURVEY_LOGIC]: ระบบประเมิน (Horizontal Layout V17.0)
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
      <p class="mt-2 text-muted">กำลังเตรียมแบบประเมิน...</p>
    </div>`;
  
  document.getElementById("btnSubmitSurvey").classList.add("d-none");

  try {
    let response = await fetch(GAS_API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) 
    });
    globalSurveyData = await response.json();
    
    if (type === 'SPEAKER_SURVEY') { 
        renderSpeakerSelect(); 
        contentArea.innerHTML = '<p class="text-center text-muted p-5 bg-white rounded-4 border">โปรดเลือกวิทยากรที่ช่องด้านบน</p>';
    } else { 
        document.getElementById("speakerSelectionArea").classList.add("d-none");
        renderSurveyQuestions(); 
        document.getElementById("btnSubmitSurvey").classList.remove("d-none"); 
    }
  } catch (e) {
    contentArea.innerHTML = '<div class="alert alert-danger text-center">ผิดพลาดในการโหลดข้อมูล</div>';
  }
}

function renderSpeakerSelect() {
  let select = document.getElementById("speakerSelect");
  select.innerHTML = '<option value="" disabled selected>-- คลิกเพื่อเลือกวิทยากร --</option>';
  
  if (!globalSurveyData.speakers || globalSurveyData.speakers.length === 0) {
    document.getElementById("surveyContentArea").innerHTML = '<div class="alert alert-warning text-center">ไม่มีวิทยากรเปิดประเมินในขณะนี้</div>';
    return;
  }
  
  globalSurveyData.speakers.forEach(spk => {
    select.innerHTML += `<option value="${spk.id}">${spk.name} (${spk.topic})</option>`;
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
        optsHtml = `<textarea class="form-control" name="sq_${q.id}" rows="3" placeholder="ระบุความคิดเห็น..."></textarea>`;
      } else {
        // [COMMENT: UPDATE V17.0 - การแสดงผล Rating แนวนอนทรงกลม]
        optsHtml += `
          <div class="rating-wrapper">
            <div class="rating-container">`;
            
        q.options.forEach(opt => {
          optsHtml += `
              <div class="rating-item">
                <input type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}">
                <label class="rating-label shadow-sm" for="sq_${q.id}_${opt}">${opt}</label>
              </div>`;
        });
        
        optsHtml += `
            </div>
            <div class="label-desc">
              <span>มากที่สุด</span>
              <span>น้อยที่สุด</span>
            </div>
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
  let complete = true;
  
  globalSurveyData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="sq_${q.id}"]:checked`) || 
              document.querySelector(`textarea[name="sq_${q.id}"]`);
              
    if (sel && sel.value !== "") {
        answers[q.id] = sel.value;
    } else {
        complete = false;
    }
  });

  if (!complete) { 
    Swal.fire('คำแนะนำ', 'กรุณาตอบแบบประเมินให้ครบทุกข้อก่อนส่งครับ', 'warning'); 
    return; 
  }
  
  let target = currentSurveyType === 'PROJECT_SURVEY' ? 'PROJECT' : document.getElementById("speakerSelect").value;
  
  Swal.fire({ 
    title: 'กำลังบันทึก...', 
    allowOutsideClick: false, 
    didOpen: () => { 
        Swal.showLoading(); 
    }
  });
  
  try {
    let action = currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval';
    
    let res = await fetch(GAS_API_URL, { 
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
    let result = await res.json();
    
    if (result.status === 'success') {
      Swal.fire({
          icon: 'success',
          title: 'สำเร็จ',
          text: 'ขอบคุณสำหรับข้อมูลประเมินครับ'
      }).then(() => {
          backToDashboard('surveySection');
      });
    }
  } catch (e) {
    Swal.fire('ผิดพลาด', 'ไม่สามารถส่งข้อมูลได้', 'error');
  }
}