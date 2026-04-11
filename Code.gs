/**
 * PROJECT: TMS-V2
 * VERSION: 52.0 (The Thai 24-Hrs Timezone Edition)
 * AUTHOR: วิ (AI Assistant)
 * DESCRIPTION: อัปเกรดระบบเวลาเป็นเขตเวลาประเทศไทย (Asia/Bangkok) 24 ชั่วโมงทั้งหมด
 */

const DB_SHARDS = {
    'ATTENDANCE': '1xYP4j7tghaSQjG56_QHg2NHQxi3B_tpmJ-Vp5wn52cU', 
    'EXAM': '1L0LpJlvMfk_Rayr70jWXk3oYUxlNsyZHUP4AEdL1p8c',
    'PROJECT': '1LMSBlfp4E0_EtBSwhQk02podq7R8EiZrHSBeCwmanVA',
    'SPEAKER': '1suKQNqhm_DKwzHUMttEgTpPq7oIsBIj_SWO_p9kYktw',
    'ASSIGNMENT': '1Gx9b8UKkLhogO90NWLbVYsE0Fk_Rr2ZfUe4_USPcNOE'
};

// 🔮 ฟังก์ชันสร้างเวลาไทย 24 ชั่วโมง (รูปแบบ: วัน/เดือน/ปี ชั่วโม:นาที:วินาที)
function getThaiTime() {
    return Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
}

function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
  
    try {
        var requestData = JSON.parse(e.postData.contents);
        var action = requestData.action;
        var payload = requestData.payload;
        var result = {};

        if (action === 'getAttendanceData') { result = getAttendanceData(payload.personal_id); }
        else if (action === 'submitAttendance') { result = submitAttendance(payload); }
        else if (action === 'getUserProfile') { result = getUserProfile(payload.personal_id); }
        else if (action === 'getExamData') { result = getExamData(payload.personal_id); }
        else if (action === 'getExamData') { result = getExamData(payload.personal_id); }
        else if (action === 'submitExam') { result = submitExam(payload); }
        else if (action === 'getSurveyData') { result = getSurveyData(payload); }
        else if (action === 'submitProjectEval') { result = submitProjectEval(payload); }
        else if (action === 'submitSpeakerEval') { result = submitSpeakerEval(payload); }
        else if (action === 'getAssignmentData') { result = getAssignmentData(payload.personal_id); }
        else if (action === 'submitAssignment') { result = submitAssignment(payload); } 
        else if (action === 'cancelAssignment') { result = cancelAssignment(payload); }
        else { result = { status: 'error', message: 'Unknown action: ' + action }; }

        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Backend Error: ' + err.message })).setMimeType(ContentService.MimeType.JSON);
    } finally { 
        lock.releaseLock(); 
    }
}

// ============================================================
// [#ASSIGNMENT_LOGIC]
// ============================================================

function submitAssignment(payload) {
    var assignSs = SpreadsheetApp.openById(DB_SHARDS['ASSIGNMENT']);
    var sheet = assignSs.getSheetByName('Assignment_Log');
    var rawTimestamp = new Date(); // ใช้สร้าง ID และตั้งชื่อไฟล์
    var logId = "ASN-" + rawTimestamp.getTime();
    var finalLink = payload.file_link || ""; 
    
    if (payload.submission_type === 'FILE') {
        if (!payload.base64Data) return { status: 'error', message: 'ไฟล์ข้อมูลขาดหายระหว่างทาง (Empty Base64)' };

        try {
            var cleanFolderId = payload.target_folder_id ? payload.target_folder_id.toString().trim() : "";
            var urlMatch = cleanFolderId.match(/[-\w]{25,}/);
            if (urlMatch) cleanFolderId = urlMatch[0];

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
        } catch (e) {
            return { status: 'error', message: 'Drive Error: ' + e.message };
        }
    }
    
    // 🔮 บันทึกเวลาลงชีตเป็นเวลาไทย 24 ชม.
    sheet.appendRow([ logId, payload.personal_id, payload.assign_id, payload.submission_type, finalLink, getThaiTime(), "รอตรวจ", "", payload.is_late ]);
    return { status: 'success' };
}

function getAssignmentData(personalId) {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = masterSs.getSheetByName('Users');
    var usersData = userSheet.getDataRange().getDisplayValues();
    var userGroup = "";
    
    for (var u = 1; u < usersData.length; u++) {
        if (usersData[u][0] === personalId) { userGroup = usersData[u][5].toString().trim(); break; }
    }
    
    var configs = masterSs.getSheetByName('Assignment_Config').getDataRange().getDisplayValues();
    var logs = SpreadsheetApp.openById(DB_SHARDS['ASSIGNMENT']).getSheetByName('Assignment_Log').getDataRange().getDisplayValues();
    
    var assignments = [];
    var userSubmissions = {};
    
    for (var i = 1; i < configs.length; i++) {
        var isActive = configs[i][7] ? configs[i][7].toUpperCase() === 'TRUE' : false;
        if (isActive) {
            var targetGroup = configs[i][8] ? configs[i][8].toString().trim().toUpperCase() : "ALL"; 
            var targetArray = targetGroup.split(',').map(function(item) { return item.trim(); });
            var isMatchGroup = (targetGroup === "ALL" || targetGroup === "" || targetArray.indexOf(userGroup) !== -1);
            
            if (isMatchGroup) {
                assignments.push({
                    assign_id: configs[i][0], title: configs[i][1], description: configs[i][2],
                    submission_type: configs[i][3], target_folder_id: configs[i][4],
                    start_datetime: configs[i][5], end_datetime: configs[i][6]
                });
            }
        }
    }
    
    for (var j = 1; j < logs.length; j++) {
        if (logs[j][1] === personalId) {
            userSubmissions[logs[j][2]] = {
                submission_type: logs[j][3], file_link: logs[j][4], timestamp: logs[j][5],
                status: logs[j][6], feedback: logs[j][7], is_late: logs[j][8]
            };
        }
    }
    return { status: 'success', assignments: assignments, userSubmissions: userSubmissions };
}

function cancelAssignment(payload) {
    var sheet = SpreadsheetApp.openById(DB_SHARDS['ASSIGNMENT']).getSheetByName('Assignment_Log');
    var data = sheet.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
        if (data[i][1] === payload.personal_id && data[i][2] === payload.assign_id) {
            if (data[i][6] === 'รอตรวจ' || data[i][6] === 'แก้ไข') {
                sheet.getRange(i + 1, 7).setValue('ยกเลิก'); return { status: 'success' };
            } else { return { status: 'error', message: 'ไม่สามารถยกเลิกได้ เนื่องจาก Mentor ตรวจให้คะแนนแล้ว' }; }
        }
    }
    return { status: 'error', message: 'ไม่พบประวัติการส่งงาน' };
}

// ============================================================
// [#ATT_LOGIC & EXAM & SURVEY] 
// ============================================================

function getAttendanceData(personalId) {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var configs = masterSs.getSheetByName('Attendance_Config').getDataRange().getDisplayValues();
    var logs = SpreadsheetApp.openById(DB_SHARDS['ATTENDANCE']).getSheetByName('Attendance_Log').getDataRange().getDisplayValues();
    var userLogs = {};
    for (var i = 1; i < logs.length; i++) { if (logs[i][1] === personalId) userLogs[logs[i][2] + '_' + logs[i][3]] = logs[i][4]; }
    var schedule = [];
    for (var j = 1; j < configs.length; j++) {
        if (configs[j][7].toUpperCase() === 'TRUE') schedule.push({ day_no: configs[j][1], date: configs[j][2], slot_id: configs[j][3], slot_label: configs[j][4], start_time: configs[j][5], end_time: configs[j][6] });
    }
    return { status: 'success', schedule: schedule, userLogs: userLogs };
}

function submitAttendance(payload) {
    // 🔮 บันทึกเวลาลงชีตเป็นเวลาไทย 24 ชม.
    SpreadsheetApp.openById(DB_SHARDS['ATTENDANCE']).getSheetByName('Attendance_Log').appendRow(["ATT-" + new Date().getTime(), payload.personal_id, payload.day_no, payload.time_slot, getThaiTime(), payload.note]);
    return { status: 'success' };
}

function getExamData(personalId) {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var configs = masterSs.getSheetByName('Exam_Config').getDataRange().getDisplayValues();
    
    // 🔮 ดึงเวลาปัจจุบัน (เวลาไทย) มาเทียบ
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
    if (!activeExam) return { status: 'error', message: 'ยังไม่ถึงเวลาเปิดให้ทำแบบทดสอบ หรือ หมดเวลาทำแบบทดสอบแล้วครับ' };
    
    var scores = SpreadsheetApp.openById(DB_SHARDS['EXAM']).getSheetByName('Test_Scores').getDataRange().getDisplayValues();
    var attempts = 0, bestScore = 0;
    for (var j = 1; j < scores.length; j++) {
        if (scores[j][1] === personalId && scores[j][2] === activeExam.type) { attempts++; bestScore = Math.max(bestScore, parseInt(scores[j][3]) || 0); }
    }
    
    var qbData = masterSs.getSheetByName('Questions_Bank').getDataRange().getDisplayValues();
    var questions = [];
    for (var k = 1; k < qbData.length; k++) {
        if (qbData[k][1] === activeExam.type + '_TEST') questions.push({ id: qbData[k][0], category: qbData[k][2], question: qbData[k][3], options: { A: qbData[k][4], B: qbData[k][5], C: qbData[k][6], D: qbData[k][7] }, answer: qbData[k][9] });
    }
    return { status: 'success', activeExam: activeExam, questions: questions, attempts: attempts, best_score: bestScore };
}

function submitExam(payload) {
    // 🔮 บันทึกเวลาลงชีตเป็นเวลาไทย 24 ชม.
    SpreadsheetApp.openById(DB_SHARDS['EXAM']).getSheetByName('Test_Scores').appendRow(["EXAM-" + new Date().getTime(), payload.personal_id, payload.test_type, payload.score, payload.max_score, getThaiTime()]);
    return { status: 'success' };
}

function getSurveyData(payload) {
    var surveyType = ""; var personalId = "";
    if (typeof payload === 'object' && payload !== null) {
        surveyType = payload.survey_type || payload.type || ""; personalId = payload.personal_id || "";
    } else if (typeof payload === 'string') { surveyType = payload; }
    if (!surveyType) throw new Error("Payload ขาดข้อมูล survey_type");
    
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var qData = masterSs.getSheetByName('Questions_Bank').getDataRange().getDisplayValues();
    var questions = [];
    for (var k = 1; k < qData.length; k++) {
        if (qData[k][1] && qData[k][1].toString().trim().toUpperCase() === surveyType.toString().trim().toUpperCase()) {
            questions.push({ id: qData[k][0], category: qData[k][2], question: qData[k][3], options: [qData[k][4], qData[k][5], qData[k][6], qData[k][7], qData[k][8]].filter(function(e) { return e.trim() !== ""; }) });
        }
    }
  
    var speakers = [];
    if (surveyType.toString().trim().toUpperCase() === 'SPEAKER_SURVEY') {
        var evaluatedList = [];
        if (personalId) {
            var evalLogs = SpreadsheetApp.openById(DB_SHARDS['SPEAKER']).getSheets()[0].getDataRange().getDisplayValues();
            for (var e = 1; e < evalLogs.length; e++) {
                if (evalLogs[e][1] === personalId) evaluatedList.push(evalLogs[e][2].toString().trim()); 
            }
        }

        var spkData = masterSs.getSheetByName('Speakers_Config').getDataRange().getDisplayValues();
        
        // 🔮 ดึงเวลาปัจจุบัน (เวลาไทย) มาเทียบ เพื่อไม่ให้พลาดเวลาวิทยากร
        var nowIsoStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss");
        var now = new Date(nowIsoStr);
        
        for (var s = 1; s < spkData.length; s++) {
            if (!spkData[s][3] || !spkData[s][4]) continue; 
            var start = new Date(spkData[s][3]); var end = new Date(spkData[s][4]);
            var isActive = spkData[s][5] ? spkData[s][5].toString().trim().toUpperCase() === 'TRUE' : false;
            
            if (isActive && now >= start && now <= end) {
                var spkId = spkData[s][0].toString().trim();
                speakers.push({ id: spkId, name: spkData[s][1], topic: spkData[s][2], is_evaluated: evaluatedList.indexOf(spkId) !== -1 });
            }
        }
    }
    return { status: 'success', questions: questions, speakers: speakers };
}

function submitProjectEval(payload) {
    // 🔮 บันทึกเวลาลงชีตเป็นเวลาไทย 24 ชม.
    SpreadsheetApp.openById(DB_SHARDS['PROJECT']).getSheets()[0].appendRow(["PROJ-" + new Date().getTime(), payload.personal_id, JSON.stringify(payload.answers), getThaiTime()]);
    return { status: 'success' };
}

function submitSpeakerEval(payload) {
    // 🔮 บันทึกเวลาลงชีตเป็นเวลาไทย 24 ชม.
    SpreadsheetApp.openById(DB_SHARDS['SPEAKER']).getSheets()[0].appendRow(["SPK-" + new Date().getTime(), payload.personal_id, payload.target_id, JSON.stringify(payload.answers), getThaiTime()]);
    return { status: 'success' };
}

function unlockDriveScope() {
    var tempFolder = DriveApp.createFolder("Test_Permission_By_Wi");
    tempFolder.setTrashed(true); 
}

// ============================================================
// [#USER_LOGIC]: ฟังก์ชันดึงข้อมูลโปรไฟล์ผู้อบรม
// ============================================================
function getUserProfile(personalId) {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = masterSs.getSheetByName('Users');
    var data = sheet.getDataRange().getDisplayValues();
    
    for (var i = 1; i < data.length; i++) {
        if (data[i][0] === personalId) { // ค้นหาจาก รหัสประจำตัว (คอลัมน์ A)
            return { 
                status: 'success', 
                data: {
                    name: data[i][1],          // อิงจากคอลัมน์ B (ชื่อ-สกุล)
                    role: data[i][2],          // อิงจากคอลัมน์ C (Role)
                    area_service: data[i][3],  // อิงจากคอลัมน์ D (Area_Service)
                    group_target: data[i][5]   // อิงจากคอลัมน์ F (group_target)
                }
            };
        }
    }
    return { status: 'error', message: 'ไม่มีรหัสประจำตัวนี้ในระบบ' };
}
