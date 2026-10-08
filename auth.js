import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const email = document.getElementById("email");
const password = document.getElementById("password");
const msg = document.getElementById("msg");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

/* ĐĂNG NHẬP */
loginBtn.onclick = async () => {
  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );

    const snap = await getDoc(doc(db, "users", cred.user.uid));

    if (!snap.exists()) {
      msg.innerHTML =
        "<span class='error'>Tài khoản chưa được cấu hình</span>";
      await signOut(auth);
      return;
    }

    if (snap.data().approved !== true) {
      msg.innerHTML =
        "<span class='error'>Tài khoản chưa được admin duyệt</span>";
      await signOut(auth);
      return;
    }

    // ✅ ĐƯỢC PHÉP VÀO
    window.location.href = "index.html";

  } catch (e) {
    msg.innerHTML =
      "<span class='error'>Sai email hoặc mật khẩu</span>";
  }
};

/* ĐĂNG KÝ */
registerBtn.onclick = async () => {
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );

    await setDoc(doc(db, "users", cred.user.uid), {
      email: email.value,
      approved: false,
      role: "user",
      createdAt: serverTimestamp()
    });

    msg.innerHTML =
      "<span class='success'>Đăng ký thành công. Chờ admin duyệt.</span>";

  } catch (e) {
    msg.innerHTML =
      "<span class='error'>Email tồn tại hoặc mật khẩu yếu</span>";
  }
};