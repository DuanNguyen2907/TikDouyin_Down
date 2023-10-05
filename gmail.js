const { ipcRenderer } = require("electron");

// Lắng nghe sự kiện khi người dùng nhấp vào nút "Gửi"
document
  .getElementById("submitButton")
  .addEventListener("click", function (event) {
    event.preventDefault(); // Ngăn tải lại trang

    // Truy xuất giá trị từ các trường biểu mẫu
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;

    // Kiểm tra dữ liệu đầu vào
    if (!isValidEmail(email)) {
      alert("Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    // Gửi yêu cầu cấp phép (thư gửi email hoặc gửi dữ liệu đến máy chủ)

    // Ví dụ: Gửi thông báo đến quá trình chính bằng cách sử dụng ipcRenderer
    ipcRenderer.send("license-request", { name, email });

    // Hiển thị thông báo cho người dùng về việc gửi yêu cầu thành công
    alert("Yêu cầu của bạn đã được ghi nhận. Vui lòng chờ xác minh.");
  });

// Hàm kiểm tra địa chỉ email hợp lệ
function isValidEmail(email) {
  // Đây chỉ là một ví dụ đơn giản. Bạn có thể sử dụng biểu thức chính quy mạnh hơn để kiểm tra email.
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}
