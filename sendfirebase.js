import { db } from "./firebase.js";
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

function getWeekNumber(date) {
  const d = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// "YYYY-MM-DD" → Date theo giờ LOCAL (tránh lệch ngày do timezone của máy)
function parseDateOnly(s) {
  const [y, m, d] = String(s || "").split("-").map(Number);
  const dt = new Date(y || 1970, (m || 1) - 1, d || 1);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

export async function sendViolations(violationList) {
  const BATCH = 400; // Firestore giới hạn 500 thao tác / nhóm

  // Gửi theo lô; lô nào commit THÀNH CÔNG thì mới xóa khỏi danh sách local.
  // → Mất mạng giữa chừng: chỉ phần CHƯA gửi còn lại, gửi lại KHÔNG bị trùng.
  while (violationList.length > 0) {
    const chunk = violationList.slice(0, BATCH);
    const batch = writeBatch(db);

    for (const v of chunk) {
      const selectedDate = parseDateOnly(v["Ngày"]);

      batch.set(doc(collection(db, "violations")), {
        maSV: v["Mã SV"],
        hoTen: v["Họ tên"],
        lop: v["Lớp"],
        khoaHoc: v["Khóa"],
        khoa: v["Khoa"],
        ngay: v["Ngày"],

        buoi: v["Buổi"],
        vipham: v["Vi phạm"],

        createdAt: serverTimestamp(),

        // ✅ PHÂN LOẠI ĐÚNG (dùng cho lịch vi phạm)
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth() + 1,
        day: selectedDate.getDate(),
        week: getWeekNumber(selectedDate),
        dateKey: v["Ngày"],
        nguoiNhap: localStorage.getItem("nguoiNhap")
      });
    }

    await batch.commit();
    violationList.splice(0, chunk.length); // đã gửi chắc chắn → gỡ khỏi danh sách local
  }
}
