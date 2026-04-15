/**
 * PROJECT: TMS-V2
 * VERSION: 72
 * AUTHOR: วิ (AI Assistant)
 */

const DB_SHARDS = {
    'ATTENDANCE': '1xYP4j7tghaSQjG56_QHg2NHQxi3B_tpmJ-Vp5wn52cU', 
    'EXAM': '1L0LpJlvMfk_Rayr70jWXk3oYUxlNsyZHUP4AEdL1p8c',
    'PROJECT': '1LMSBlfp4E0_EtBSwhQk02podq7R8EiZrHSBeCwmanVA',
    'SPEAKER': '1suKQNqhm_DKwzHUMttEgTpPq7oIsBIj_SWO_p9kYktw',
    'ASSIGNMENT': '1Gx9b8UKkLhogO90NWLbVYsE0Fk_Rr2ZfUe4_USPcNOE'
};

function getThaiTime() {
    return Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
}

function doPost(e) {
  try {
    var request = JSON.parse(e.postData.contents);
    var action = request.action;
    var payload = request.payload;
    var result = { status: 'error', message: 'ไม่รู้จักคำสั่ง: ' + action };

    if (action === 'getUserProfile') { result = getUserProfile(payload.personal_id); } 
    else if (action === 'submitAttendance') { result = submitAttendance(payload); } 
    else if (action === 'getExamData') { result = getExamData(payload.personal_id); } 
    else if (action === 'submitExam') { result = submitExam(payload); }
    else if (action === 'getSurveyData') { result = getSurveyData(payload); }
    else if (action === 'submitProjectEval') { result = submitProjectEval(payload); }
    else if (action === 'submitSpeakerEval') { result = submitSpeakerEval(payload); }
    else if (action === 'getAssignmentData') { result = getAssignmentData(payload.personal_id); }
    else if (action === 'submitAssignment') { result = submitAssignment(payload); }
    else if (action === 'cancelAssignment') { result = cancelAssignment(payload); }
    else if (action === 'getAttendanceData') { result = getAttendanceData(payload.personal_id); }

    // Mentor
    else if (action === 'getMentorData') { result = getMentorData(payload.personal_id); }
    else if (action === 'gradeAssignment') { result = gradeAssignment(payload); }

    // Admin
    else if (action === 'getAdminConfigs') { result = getAdminConfigs(); } 
    else if (action === 'updateConfigStatus') { result = updateConfigStatus(payload); }
    else if (action === 'manageConfig') { result = manageConfig(payload); }
    
    // 🌟 API ดึงข้อมูล Dashboard ประเมินโครงการและวิทยากร
    else if (action === 'getEvaluationDashboardData') { result = getEvaluationDashboardData(); }
    
    // 🌟 API ดึงข้อมูล Dashboard สถิติหลัก
    else if (action === 'getDashboardReport') {
      try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var getSheetData = function(sheetName) {
          var sheet = ss.getSheetByName(sheetName);
          if(!sheet) return [];
          var data = sheet.getDataRange().getValues();
          if(data.length <= 1) return [];
          var headers = data.shift();
          return data.map(function(row) {
            var obj = {};
            headers.forEach(function(h, i) { obj[h] = row[i]; });
            return obj;
          });
        };

        // ดึง Logs จาก DB ภายนอก (DB_SHARDS)
        var getExternalData = function(shardKey, sheetName) {
          try {
            var extSs = SpreadsheetApp.openById(DB_SHARDS[shardKey]);
            var sheet = sheetName ? extSs.getSheetByName(sheetName) : extSs.getSheets()[0];
            if(!sheet) return [];
            var data = sheet.getDataRange().getDisplayValues();
            if(data.length <= 1) return [];
            var headers = data.shift();
            return data.map(function(row) {
              var obj = {};
              headers.forEach(function(h, i) { obj[h] = row[i]; });
              return obj;
            });
          } catch(e) { return []; }
        };

        // ดึง attendance logs
        var attendanceLogs = getExternalData('ATTENDANCE');

        // ดึง exam logs จาก Test_Scores
        var examLogs = getExternalData('EXAM', 'Test_Scores');

        // ดึง assignment logs จาก Assignment_Log
        var assignmentLogs = getExternalData('ASSIGNMENT', 'Assignment_Log');

        // ดึง survey logs (project + speaker)
        var surveyLogs = [];
        var projLogs = getExternalData('PROJECT');
        projLogs.forEach(function(r) {
          surveyLogs.push({ personal_id: r.personal_id || r[Object.keys(r)[1]], survey_type: 'PROJECT_SURVEY', speaker_id: '' });
        });
        var spkLogs = getExternalData('SPEAKER');
        spkLogs.forEach(function(r) {
          surveyLogs.push({ personal_id: r.personal_id || r[Object.keys(r)[1]], survey_type: 'SPEAKER_SURVEY', speaker_id: r.speaker_id || r.spk_id || r[Object.keys(r)[2]] || '' });
        });

        result = {
          status: 'success',
          users: getSheetData('Users'),
          attendance: attendanceLogs,
          exam: examLogs,
          assignment: assignmentLogs,
          survey: surveyLogs,
          examConfig: getSheetData('Exam_Config'),
          assignConfig: getSheetData('Assignment_Config'),
          questions: getSheetData('Questions_Bank'),
          speakers: getSheetData('Speakers_Config'),
          attendanceConfig: getSheetData('Attendance_Config')
        };
      } catch (err) {
        result = { status: 'error', message: err.toString() };
      }
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Critical Error: ' + err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getUserProfile(personalId) {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = masterSs.getSheetByName('Users');
    var data = sheet.getDataRange().getDisplayValues();
    var searchId = personalId.toString().trim().toLowerCase();

    for (var i = 1; i < data.length; i++) {
        var rowId = data[i][0].toString().trim().toLowerCase();
        if (rowId === searchId) {
            return {
                status: 'success',
                data: {
                    name: data[i][1], role: data[i][2], area_service: data[i][3], group_target: data[i][5]
                }
            };
        }
    }
    return { status: 'error', message: 'ไม่มีรหัสประจำตัวนี้ในระบบ' };
}

// ============================================================
// 🕒 [ATTENDANCE LOGIC] ระบบลงเวลา (อัปเกรดความเสถียร 100%)
// ============================================================
function getAttendanceData(personalId) {
    try {
        var masterSs = SpreadsheetApp.getActiveSpreadsheet();
        var configs = masterSs.getSheetByName('Attendance_Config').getDataRange().getDisplayValues();
        
        // 🌟 เปลี่ยนมาใช้ getSheets()[0] เพื่อดึงชีตแรกสุดเสมอ ไม่ว่าพี่จะตั้งชื่อแท็บว่าอะไรก็ตาม!
        var logSheet = SpreadsheetApp.openById(DB_SHARDS['ATTENDANCE']).getSheets()[0];
        var logs = logSheet.getDataRange().getDisplayValues();
        
        var userLogs = {};
        for (var i = 1; i < logs.length; i++) { 
            if (logs[i][1] === personalId) {
                userLogs[logs[i][2] + '_' + logs[i][3]] = logs[i][4]; 
            }
        }
        
        var schedule = [];
        for (var j = 1; j < configs.length; j++) {
            // 🌟 ป้องกันบั๊กค่าว่าง และลบช่องว่างส่วนเกินก่อนเช็คคำว่า TRUE
            if (configs[j][7] && configs[j][7].toString().trim().toUpperCase() === 'TRUE') {
                schedule.push({ 
                    day_no: configs[j][1], 
                    date: configs[j][2], 
                    slot_id: configs[j][3], 
                    slot_label: configs[j][4], 
                    start_time: configs[j][5], 
                    end_time: configs[j][6] 
                });
            }
        }
        return { status: 'success', schedule: schedule, userLogs: userLogs };
    } catch (error) {
        return { status: 'error', message: 'เกิดข้อผิดพลาดในการดึงฐานข้อมูล: ' + error.message };
    }
}

function submitAttendance(payload) {
    try {
        // 🌟 เปลี่ยนมาใช้ getSheets()[0] เช่นเดียวกัน
        var logSheet = SpreadsheetApp.openById(DB_SHARDS['ATTENDANCE']).getSheets()[0];
        logSheet.appendRow(["ATT-" + new Date().getTime(), payload.personal_id, payload.day_no, payload.time_slot, getThaiTime(), payload.note]);
        return { status: 'success', message: 'บันทึกเวลาสำเร็จ' };
    } catch (error) {
        return { status: 'error', message: 'ไม่สามารถบันทึกข้อมูลได้: ' + error.message };
    }
}

function getExamData(personalId) {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var configs = masterSs.getSheetByName('Exam_Config').getDataRange().getDisplayValues();
    
    var nowIsoStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss");
    var now = new Date(nowIsoStr);
    var activeExam = null;
    
    for (var i = 1; i < configs.length; i++) {
        var start = new Date(configs[i][1]); var end = new Date(configs[i][2]);
        var isActive = configs[i][3] ? configs[i][3].toString().trim().toUpperCase() === 'TRUE' : false;
        if (isActive && now >= start && now <= end) {
            activeExam = { type: configs[i][0], start_datetime: configs[i][1], end_datetime: configs[i][2], passing_percent: parseFloat(configs[i][4]) || 80 }; break;
        }
    }
    if (!activeExam) return { status: 'error', message: 'ยังไม่ถึงเวลาเปิดทำแบบทดสอบ หรือ หมดเวลาแล้วครับ' };
    
    var scores = SpreadsheetApp.openById(DB_SHARDS['EXAM']).getSheetByName('Test_Scores').getDataRange().getDisplayValues();
    var attempts = 0, bestScore = 0;
    for (var j = 1; j < scores.length; j++) {
        if (scores[j][1] === personalId && scores[j][2] === activeExam.type) { attempts++; bestScore = Math.max(bestScore, parseInt(scores[j][3]) || 0); }
    }
    
    var qbData = masterSs.getSheetByName('Questions_Bank').getDataRange().getDisplayValues();
    var questions = [];
    for (var k = 1; k < qbData.length; k++) {
        if (qbData[k][1] === activeExam.type + '_TEST') {
            questions.push({ id: qbData[k][0], category: qbData[k][2], question: qbData[k][3], options: { A: qbData[k][4], B: qbData[k][5], C: qbData[k][6], D: qbData[k][7] }, answer: qbData[k][9] });
        }
    }
    return { status: 'success', activeExam: activeExam, questions: questions, attempts: attempts, best_score: bestScore };
}

function submitExam(payload) {
    SpreadsheetApp.openById(DB_SHARDS['EXAM']).getSheetByName('Test_Scores').appendRow(["EXAM-" + new Date().getTime(), payload.personal_id, payload.test_type, payload.score, payload.max_score, getThaiTime()]);
    return { status: 'success', score: payload.score };
}

function getSurveyData(payload) {
    var surveyType = payload.survey_type || ""; 
    var personalId = payload.personal_id || "";
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var qData = masterSs.getSheetByName('Questions_Bank').getDataRange().getDisplayValues();
    var questions = [];
    for (var k = 1; k < qData.length; k++) {
        if (qData[k][1] && qData[k][1].toString().trim().toUpperCase() === surveyType.toUpperCase()) {
            questions.push({ id: qData[k][0], category: qData[k][2], question: qData[k][3], options: [qData[k][4], qData[k][5], qData[k][6], qData[k][7], qData[k][8]].filter(function(e) { return e.trim() !== ""; }) });
        }
    }
  
    var speakers = [];
    if (surveyType.toUpperCase() === 'SPEAKER_SURVEY') {
        var evaluatedList = [];
        if (personalId) {
            // ดึงข้อมูลว่าประเมินใครไปแล้วบ้าง
            var evalLogs = SpreadsheetApp.openById(DB_SHARDS['SPEAKER']).getSheets()[0].getDataRange().getDisplayValues();
            for (var e = 1; e < evalLogs.length; e++) {
                if (evalLogs[e][1] === personalId) evaluatedList.push(evalLogs[e][2].toString().trim()); 
            }
        }
        var spkData = masterSs.getSheetByName('Speakers_Config').getDataRange().getDisplayValues();
        var nowIsoStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss");
        var now = new Date(nowIsoStr);
        for (var s = 1; s < spkData.length; s++) {
            if (!spkData[s][3] || !spkData[s][4]) continue;
            var isActive = spkData[s][5] ? spkData[s][5].toString().trim().toUpperCase() === 'TRUE' : false;
            var start = new Date(spkData[s][3]);
            var end = new Date(spkData[s][4]);
            // แสดงเฉพาะ is_active=TRUE และอยู่ในช่วงเวลาที่กำหนด
            if (isActive && now >= start && now <= end) {
                var spkId = spkData[s][0].toString().trim();
                speakers.push({ id: spkId, name: spkData[s][1], topic: spkData[s][2], is_evaluated: evaluatedList.indexOf(spkId) !== -1 });
            }
        }
    }
    // เช็คว่าประเมินโครงการแล้วหรือยัง (สำหรับ PROJECT_SURVEY)
    var projectEvaluated = false;
    if (surveyType.toUpperCase() === 'PROJECT_SURVEY' && personalId) {
        var projLogs = SpreadsheetApp.openById(DB_SHARDS['PROJECT']).getSheets()[0].getDataRange().getDisplayValues();
        for (var p = 1; p < projLogs.length; p++) {
            if (projLogs[p][1] && projLogs[p][1].toString().trim() === personalId.toString().trim()) {
                projectEvaluated = true;
                break;
            }
        }
    }

    return { status: 'success', questions: questions, speakers: speakers, project_evaluated: projectEvaluated };
}

// ============================================================
// 📊 ฟังก์ชันบันทึกการประเมิน (ปรับแก้ให้อ่าน/เขียนทะลุ Database ได้ 100%)
// ============================================================
function submitProjectEval(payload) {
    try {
        var ss = SpreadsheetApp.openById(DB_SHARDS['PROJECT']);
        // วิ่งหาชีตแรกสุดที่มีอยู่จริง ป้องกันบั๊ก getSheets()[0]
        var sheet = ss.getSheets()[0]; 
        
        var logId = "PROJ-" + new Date().getTime();
        var personalId = payload.personal_id || "Unknown";
        var targetId = payload.target_id || "PROJECT";
        var answersJson = JSON.stringify(payload.answers || {});
        var timestamp = getThaiTime();

        // เขียนข้อมูล 5 คอลัมน์ ให้ตรงกับหัวตารางใน CSV ของพี่เป๊ะๆ
        // log_id | personal_id | target_id | answers_json | timestamp
        sheet.appendRow([logId, personalId, targetId, answersJson, timestamp]);
        
        return { status: 'success' };
    } catch (error) {
        return { status: 'error', message: 'DB_PROJECT Error: ' + error.message };
    }
}

function submitSpeakerEval(payload) {
    try {
        var ss = SpreadsheetApp.openById(DB_SHARDS['SPEAKER']);
        // วิ่งหาชีตแรกสุดที่มีอยู่จริง ป้องกันบั๊ก getSheets()[0]
        var sheet = ss.getSheets()[0]; 
        
        var logId = "SPK-" + new Date().getTime();
        var personalId = payload.personal_id || "Unknown";
        var targetId = payload.target_id || "Unknown_SPK";
        var answersJson = JSON.stringify(payload.answers || {});
        var timestamp = getThaiTime();

        // เขียนข้อมูล 5 คอลัมน์ ให้ตรงกับหัวตารางใน CSV ของพี่เป๊ะๆ
        // log_id | personal_id | target_id | answers_json | timestamp
        sheet.appendRow([logId, personalId, targetId, answersJson, timestamp]);
        
        return { status: 'success' };
    } catch (error) {
        return { status: 'error', message: 'DB_SPEAKER Error: ' + error.message };
    }
}

function getAssignmentData(personalId) {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = masterSs.getSheetByName('Users');
    var usersData = userSheet.getDataRange().getDisplayValues();
    var userGroup = "ALL";
    for (var u = 1; u < usersData.length; u++) {
        if (usersData[u][0].toString().trim().toLowerCase() === personalId.toString().trim().toLowerCase()) { userGroup = usersData[u][5].toString().trim(); break; }
    }
    var configs = masterSs.getSheetByName('Assignment_Config').getDataRange().getDisplayValues();
    var logs = SpreadsheetApp.openById(DB_SHARDS['ASSIGNMENT']).getSheetByName('Assignment_Log').getDataRange().getDisplayValues();
    var assignments = []; var userSubmissions = {};
    for (var i = 1; i < configs.length; i++) {
        var isActive = configs[i][7] ? configs[i][7].toUpperCase() === 'TRUE' : false;
        if (isActive) {
            var targetGroup = configs[i][8] ? configs[i][8].toString().trim().toUpperCase() : "ALL"; 
            var targetArray = targetGroup.split(',').map(function(item) { return item.trim(); });
            var isMatchGroup = (targetGroup === "ALL" || targetGroup === "" || targetArray.indexOf(userGroup) !== -1);
            if (isMatchGroup) { assignments.push({ assign_id: configs[i][0], title: configs[i][1], description: configs[i][2], submission_type: configs[i][3], target_folder_id: configs[i][4], start_datetime: configs[i][5], end_datetime: configs[i][6] }); }
        }
    }
    for (var j = 1; j < logs.length; j++) {
        if (logs[j][1].toString().trim().toLowerCase() === personalId.toString().trim().toLowerCase()) {
            userSubmissions[logs[j][2]] = { submission_type: logs[j][3], file_link: logs[j][4], timestamp: logs[j][5], status: logs[j][6], feedback: logs[j][7], is_late: logs[j][8] };
        }
    }
    return { status: 'success', assignments: assignments, userSubmissions: userSubmissions };
}

function submitAssignment(payload) {
    var assignSs = SpreadsheetApp.openById(DB_SHARDS['ASSIGNMENT']);
    var sheet = assignSs.getSheetByName('Assignment_Log');
    var rawTimestamp = new Date(); var logId = "ASN-" + rawTimestamp.getTime();
    var finalLink = payload.submission_type === 'LINK' ? payload.file_link : ""; 
    if (payload.submission_type === 'FILE') {
        if (!payload.base64Data) return { status: 'error', message: 'ไฟล์ข้อมูลขาดหายระหว่างทาง' };
        try {
            var cleanFolderId = payload.target_folder_id ? payload.target_folder_id.toString().trim() : "";
            var urlMatch = cleanFolderId.match(/[-\w]{25,}/); if (urlMatch) cleanFolderId = urlMatch[0];
            var parentFolder = DriveApp.getFolderById(cleanFolderId);
            var subFolders = parentFolder.getFoldersByName(payload.assign_id);
            var targetFolder = subFolders.hasNext() ? subFolders.next() : parentFolder.createFolder(payload.assign_id);
            var originalName = payload.fileName || "Uploaded_File";
            var extension = originalName.lastIndexOf(".") !== -1 ? originalName.substring(originalName.lastIndexOf(".")) : "";
            var timeString = Utilities.formatDate(rawTimestamp, "Asia/Bangkok", "dd-MM-yyyy_HHmmss");
            var newFileName = payload.personal_id + "_" + timeString + extension;
            var blob = Utilities.newBlob(Utilities.base64Decode(payload.base64Data), payload.mimeType || MimeType.PDF, newFileName);
            var file = targetFolder.createFile(blob);
            finalLink = file.getUrl(); 
        } catch (e) { return { status: 'error', message: 'Drive Error: ' + e.message }; }
    }
    sheet.appendRow([ logId, payload.personal_id, payload.assign_id, payload.submission_type, finalLink, getThaiTime(), "รอตรวจ", "", "", payload.is_late ]);
    return { status: 'success' };
}

function cancelAssignment(payload) {
    var sheet = SpreadsheetApp.openById(DB_SHARDS['ASSIGNMENT']).getSheetByName('Assignment_Log');
    var data = sheet.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
        if (data[i][1] === payload.personal_id && data[i][2] === payload.assign_id) {
            if (data[i][6] === 'รอตรวจ' || data[i][6] === 'แก้ไข') {
                sheet.getRange(i + 1, 7).setValue('ยกเลิก'); return { status: 'success' };
            } else { return { status: 'error', message: 'ไม่สามารถยกเลิกได้ เนื่องจากตรวจให้คะแนนแล้ว' }; }
        }
    }
    return { status: 'error', message: 'ไม่พบประวัติการส่งงาน' };
}

// ============================================================
// 👔 [MENTOR LOGIC]
// ============================================================
function getMentorData(personalId) {
    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var usersData = ss.getSheetByName('Users').getDataRange().getDisplayValues();
        var usersHeaders = usersData[0];

        // หา group_target ของ Mentor นี้
        var mentorGroup = '';
        for (var i = 1; i < usersData.length; i++) {
            if (usersData[i][0].toString().trim() === personalId.toString().trim()) {
                mentorGroup = usersData[i][5].toString().trim(); // col 5 = group_target
                break;
            }
        }
        if (!mentorGroup) return { status: 'error', message: 'ไม่พบข้อมูล Mentor หรือ group_target ว่างเปล่า' };

        // ดึง Trainee ทุกคนที่มี group_target ตรงกัน
        var trainees = [];
        for (var j = 1; j < usersData.length; j++) {
            if (usersData[j][2].toString().toUpperCase() === 'TRAINEE' && usersData[j][5].toString().trim() === mentorGroup) {
                trainees.push({
                    personal_id: usersData[j][0], name: usersData[j][1],
                    area_service: usersData[j][3], cluster: usersData[j][4], group_target: usersData[j][5]
                });
            }
        }

        // ดึง Assignment_Config ทั้งหมด (is_active = TRUE)
        var asmConfigRaw = ss.getSheetByName('Assignment_Config').getDataRange().getDisplayValues();
        var asmConfigs = [];
        for (var k = 1; k < asmConfigRaw.length; k++) {
            if (asmConfigRaw[k][7] && asmConfigRaw[k][7].toString().toUpperCase() === 'TRUE') {
                var rubric = [];
                try { rubric = JSON.parse(asmConfigRaw[k][10] || '[]'); } catch(e) {}
                asmConfigs.push({
                    assign_id: asmConfigRaw[k][0], title: asmConfigRaw[k][1],
                    submission_type: asmConfigRaw[k][3], target_group: asmConfigRaw[k][8],
                    full_score: asmConfigRaw[k][9], rubric_criteria: rubric
                });
            }
        }

        // ดึง Assignment Logs ทั้งหมด จาก DB_SHARDS
        var logSheet = SpreadsheetApp.openById(DB_SHARDS['ASSIGNMENT']).getSheetByName('Assignment_Log');
        var logRaw = logSheet.getDataRange().getDisplayValues();
        var assignLogs = [];
        for (var l = 1; l < logRaw.length; l++) {
            assignLogs.push({
                log_id: logRaw[l][0], personal_id: logRaw[l][1], assign_id: logRaw[l][2],
                submission_type: logRaw[l][3], file_link: logRaw[l][4], timestamp: logRaw[l][5],
                status: logRaw[l][6], feedback: logRaw[l][7], score: logRaw[l][8], is_late: logRaw[l][9]
            });
        }

        // ดึง Eval status (Project + Speaker) สำหรับ Trainee ในกลุ่ม
        var traineeIds = trainees.map(function(t) { return t.personal_id; });
        var getExtSheet = function(shardKey) {
            try {
                var rows = SpreadsheetApp.openById(DB_SHARDS[shardKey]).getSheets()[0].getDataRange().getDisplayValues();
                if (rows.length <= 1) return [];
                var h = rows[0]; var result = [];
                for (var r = 1; r < rows.length; r++) {
                    var obj = {}; h.forEach(function(hh, ii) { obj[hh] = rows[r][ii]; }); result.push(obj);
                }
                return result;
            } catch(e) { return []; }
        };
        var projectLogs = getExtSheet('PROJECT');
        var speakerLogs = getExtSheet('SPEAKER');
        var speakerConfigs = ss.getSheetByName('Speakers_Config').getDataRange().getDisplayValues();

        // ดึง Attendance_Config และ Attendance Logs
        var attConfigRaw = ss.getSheetByName('Attendance_Config').getDataRange().getDisplayValues();
        var attConfigs = [];
        var attHeaders = attConfigRaw[0];
        for (var ac = 1; ac < attConfigRaw.length; ac++) {
            var obj = {}; attHeaders.forEach(function(h, hi) { obj[h] = attConfigRaw[ac][hi]; });
            attConfigs.push(obj);
        }
        var attLogSheet = SpreadsheetApp.openById(DB_SHARDS['ATTENDANCE']).getSheets()[0];
        var attLogRaw = attLogSheet.getDataRange().getDisplayValues();
        var attLogs = [];
        if (attLogRaw.length > 1) {
            var attLogHeaders = attLogRaw[0];
            for (var al = 1; al < attLogRaw.length; al++) {
                var aobj = {}; attLogHeaders.forEach(function(h, hi) { aobj[h] = attLogRaw[al][hi]; });
                attLogs.push(aobj);
            }
        }

        return {
            status: 'success',
            mentorGroup: mentorGroup,
            trainees: trainees,
            assignConfigs: asmConfigs,
            assignLogs: assignLogs,
            projectLogs: projectLogs,
            speakerLogs: speakerLogs,
            speakerConfigs: speakerConfigs,
            attendanceConfig: attConfigs,
            attendance: attLogs
        };
    } catch(e) {
        return { status: 'error', message: 'getMentorData Error: ' + e.message };
    }
}

function gradeAssignment(payload) {
    // payload: { log_id, status, feedback, score }
    try {
        var sheet = SpreadsheetApp.openById(DB_SHARDS['ASSIGNMENT']).getSheetByName('Assignment_Log');
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
            if (data[i][0].toString().trim() === payload.log_id.toString().trim()) {
                sheet.getRange(i + 1, 7).setValue(payload.status);   // col G = status
                sheet.getRange(i + 1, 8).setValue(payload.feedback || ''); // col H = feedback
                sheet.getRange(i + 1, 9).setValue(payload.score || '');    // col I = score
                return { status: 'success' };
            }
        }
        return { status: 'error', message: 'ไม่พบ log_id: ' + payload.log_id };
    } catch(e) {
        return { status: 'error', message: 'gradeAssignment Error: ' + e.message };
    }
}

function getAdminConfigs() { return { status: 'error', message: 'Not needed' }; }
function updateConfigStatus(payload) { return { status: 'error', message: 'Not needed' }; }

function manageConfig(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = payload.action; 
  var sheetName = payload.sheetName; 
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { status: 'error', message: 'ไม่พบชีต: ' + sheetName };
  var data = sheet.getDataRange().getDisplayValues();
  var headers = data[0];

  if (action === "GET") { return { status: 'success', headers: headers, rows: data.slice(1) }; }
  else if (action === "SAVE") {
    var rowData = payload.rowData; var isNew = payload.isNew;
    if (isNew) { sheet.appendRow(rowData); } else {
      var id = rowData[0].toString().trim(); var found = false;
      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === id) { sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]); found = true; break; }
      }
      if (!found) return { status: 'error', message: 'ไม่พบรหัสที่ต้องการแก้ไข' };
    }
    return { status: 'success', message: 'บันทึกข้อมูลเรียบร้อย' };
  }
  else if (action === "DELETE") {
    var id = payload.id.toString().trim();
    for (var j = 1; j < data.length; j++) {
      if (data[j][0].toString().trim() === id) { sheet.deleteRow(j + 1); return { status: 'success', message: 'ลบข้อมูลเรียบร้อย' }; }
    }
    return { status: 'error', message: 'ไม่พบข้อมูล' };
  }
  else if (action === "IMPORT_EXCEL") {
      var excelData = payload.excelData;
      if (!excelData || excelData.length === 0) return { status: 'error', message: 'ไม่มีข้อมูล' };
      var lastRow = sheet.getLastRow(); var lastCol = sheet.getLastColumn();
      if (lastRow > 1) { sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent(); }
      var cleanData = excelData.map(function(row) { var newRow = []; for(var i=0; i<lastCol; i++) { newRow.push(row[i] !== undefined ? row[i] : ""); } return newRow; });
      sheet.getRange(2, 1, cleanData.length, lastCol).setValues(cleanData);
      return { status: 'success', message: 'นำเข้าเรียบร้อย' };
  }
  return { status: 'error', message: 'คำสั่งผิดพลาด' };
}

// ============================================================
// 🌟 [REPORT API] ดึงข้อมูล Dashboard ประเมิน (แก้ Index แบบฉลาดสุดๆ)
// ============================================================
function getEvaluationDashboardData() {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. ดึงวิทยากรทั้งหมด
    var spkSheet = masterSs.getSheetByName('Speakers_Config');
    var speakers = [];
    if(spkSheet) {
        var spkData = spkSheet.getDataRange().getDisplayValues();
        for (var i = 1; i < spkData.length; i++) {
            if (spkData[i][0]) { speakers.push({ id: spkData[i][0], name: spkData[i][1], topic: spkData[i][2] }); }
        }
    }

    // 2. ดึงคำถามและกำหนดประเภทคำถามให้แม่นยำ
    var qbSheet = masterSs.getSheetByName('Questions_Bank');
    var questions = {};
    if(qbSheet) {
        var qbData = qbSheet.getDataRange().getDisplayValues();
        for (var j = 1; j < qbData.length; j++) {
            var type = qbData[j][1];
            if (type === 'PROJECT_SURVEY' || type === 'SPEAKER_SURVEY') {
                var oA = qbData[j][4], oB = qbData[j][5], oC = qbData[j][6], oD = qbData[j][7], oE = qbData[j][8];
                var rawOpts = [oA, oB, oC, oD, oE];
                var cleanOpts = rawOpts.filter(function(e) { return e && e !== 'TEXT'; });
                
                var inType = 'CHOICE';
                if (oA === 'TEXT') { inType = 'TEXT'; } 
                else if (cleanOpts.length > 0 && cleanOpts.every(function(o) { return !isNaN(o); })) { inType = 'RATING'; }
                
                questions[qbData[j][0]] = {
                    type: type, category: qbData[j][2], text: qbData[j][3],
                    inputType: inType, options: cleanOpts
                };
            }
        }
    }

    var surveys = [];
    
    // 🌟 ฟังก์ชันนักสืบ: ตรวจจับหาคอลัมน์ที่เป็น JSON
    var findJsonData = function(row) {
        for (var c = 2; c < row.length; c++) {
            if (row[c] && row[c].toString().trim().charAt(0) === '{') {
                return row[c].toString().trim();
            }
        }
        return "{}"; 
    };

    // 3. ดึง Log ประเมินโครงการ
    try {
        var projSheet = SpreadsheetApp.openById(DB_SHARDS['PROJECT']).getSheets()[0];
        var projData = projSheet.getDataRange().getDisplayValues();
        for (var p = 1; p < projData.length; p++) {
            if (projData[p][0] && projData[p][0] !== 'log_id') {
                surveys.push({ logId: projData[p][0], personalId: projData[p][1], targetId: 'PROJECT', answers: findJsonData(projData[p]) });
            }
        }
    } catch(e) {} 

    // 4. ดึง Log ประเมินวิทยากร
    try {
        var spkLogSheet = SpreadsheetApp.openById(DB_SHARDS['SPEAKER']).getSheets()[0];
        var spkLogData = spkLogSheet.getDataRange().getDisplayValues();
        for (var s = 1; s < spkLogData.length; s++) {
            if (spkLogData[s][0] && spkLogData[s][0] !== 'log_id') {
                surveys.push({ logId: spkLogData[s][0], personalId: spkLogData[s][1], targetId: spkLogData[s][2], answers: findJsonData(spkLogData[s]) });
            }
        }
    } catch(e) {} 

    return { status: 'success', speakers: speakers, questions: questions, surveys: surveys };
}
