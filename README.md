# HUST Study Tracker (Quản lý học phần HUST)

Chrome Extension hỗ trợ sinh viên Đại học Bách Khoa Hà Nội (HUST) quản lý lộ trình học tập, tính toán CPA/GPA và dự báo điểm số trực tiếp trên trang quản lý đào tạo `ctt-sis.hust.edu.vn`.

Tiện ích tự động quét dữ liệu từ trang CTT-SIS để xây dựng một Dashboard cá nhân hóa trực quan, giúp bạn theo dõi tiến độ tích lũy, các học phần còn thiếu để tốt nghiệp và thử nghiệm cải thiện điểm số.

---

## ✨ Tính năng nổi bật

### 1. 📊 Dashboard Tiến Độ Học Tập
* **Tính toán CPA/GPA tự động**: Theo dõi CPA hệ 4.0 và tổng tín chỉ đã hoàn thành chính xác.
* **Tích lũy trực quan**: Hiển thị tỷ lệ hoàn thành chương trình dưới dạng `Đạt được / Tổng số` tín chỉ (Ví dụ: `102/135 TC`).
* **Hỗ trợ chọn nhiều Mô đun chuyên ngành**: Tích chọn đồng thời nhiều mô đun đăng ký (ví dụ: Mô đun 1 + 4), tự động gộp và loại bỏ các môn trùng lặp để tính toán chính xác số tín chỉ và CPA.
* **Lựa chọn loại Đồ án tốt nghiệp**: Chọn giữa **Đồ án cử nhân (6 TC)** hoặc **Đồ án kỹ sư/nghiên cứu (10-12 TC)**. Hệ thống tự động cập nhật tổng số tín chỉ cần thiết và số tín chỉ còn thiếu tương ứng.

### 2. 🎓 Học Phần Còn Thiếu Để Tốt Nghiệp
* **Bảng tổng hợp tập trung**: Liệt kê toàn bộ các môn học còn thiếu của các khối kiến thức bắt buộc và mô đun chuyên ngành đã chọn.
* **Sắp xếp thông minh**: Các môn học được sắp xếp theo lộ trình học tập tự nhiên (Triết học, Đại cương lên trước; Thực tập, Mô đun chuyên ngành ở giữa và **Đồ án tốt nghiệp luôn ở cuối cùng**).
* **Thu gọn/Mở rộng tiện lợi**: Các danh sách môn học chi tiết của từng khối kiến thức được thu gọn mặc định giúp giao diện Dashboard gọn gàng, bao quát tốt hơn.
* **Bộ lọc Giáo dục thể chất**: Riêng khối GDTC (yêu cầu tích lũy số lượng môn) chỉ hiển thị các môn học bạn đã hoàn thành để giảm tải thông tin thừa.

### 3. 🎯 Quản Lý & Dự Đoán Điểm Số (Marks Panel)
* **Bộ lọc học phần đa năng**:
  * Tìm kiếm nhanh theo Mã học phần hoặc Tên học phần trực tiếp (Live Search).
  * Lọc môn học theo Học kỳ thực tế (hệ thống tự quét và hiển thị các học kỳ hiện có).
  * Lọc môn học theo Điểm chữ (A/A+, B/B+, C/C+, D/D+, F).
  * Lọc nhanh theo Trạng thái: *Môn học gốc*, *Môn học dự kiến*, *Môn đã cải thiện*, *Môn đã đỗ (qua môn)*, *Môn trượt / nợ*.
* **Tích chọn tính toán CPA động**: Tự động chọn tất cả môn học khi mở bảng điểm. Bạn có thể tích/bỏ tích các môn cụ thể để xem CPA thay đổi tương ứng.
* **Dự đoán môn học mới**: Nhập mã môn, số tín chỉ và điểm chữ mong muốn để tính toán thử CPA tương lai.
* **Cải thiện điểm học phần cũ**: Click trực tiếp vào điểm chữ của môn cũ trong bảng điểm (kể cả các môn bị F ở các kỳ trước) để thử nâng lên điểm cao hơn và xem CPA cải thiện.

---

## 🛠️ Hướng dẫn cài đặt

### 💻 Trên máy tính (Chrome, Edge, Opera, Brave,...)

1. Tải mã nguồn của extension về máy tính bằng cách nhân bản kho lưu trữ Git:
   ```bash
   git clone https://github.com/quangngv/hust-study-tracker.git
   ```
   *Hoặc tải file ZIP từ GitHub của dự án này và giải nén.*

2. Mở trình duyệt Google Chrome (hoặc Edge, Opera, Brave) và truy cập vào trang quản lý tiện ích:
   ```text
   chrome://extensions
   ```

3. Bật **Developer mode** (Chế độ dành cho nhà phát triển) ở góc phía trên bên phải.
4. Bấm vào nút **Load unpacked** (Tải tiện ích đã giải nén) ở góc phía trên bên trái.
5. Chọn thư mục chứa mã nguồn của extension đã giải nén ở Bước 1.
6. Quay lại trang CTT-SIS và tải lại trang (Refresh).

### 📱 Trên điện thoại (Dành riêng cho thiết bị di động)

Để cài đặt và sử dụng extension trên điện thoại, bạn cần thực hiện theo các bước sau:

1. **Cài đặt trình duyệt hỗ trợ**: Tải và cài đặt trình duyệt **Orion Browser** (hỗ trợ cài đặt extension Chrome/Firefox) từ App Store (iOS) hoặc cửa hàng ứng dụng trên điện thoại của bạn.
2. **Tải file tiện ích**: Tải file tiện ích [hust-study-tracker.crx](file:///C:/Users/Admin/Downloads/hust-qlhp-main/hust-qlhp-main/hust-study-tracker.crx) trực tiếp về bộ nhớ điện thoại.
3. **Cài đặt vào trình duyệt**:
   * Mở trình duyệt **Orion Browser**.
   * Mở cài đặt/menu của trình duyệt và tìm đến mục **Extensions** (Tiện ích mở rộng).
   * Chọn tính năng cài đặt tiện ích từ file (thường là biểu tượng dấu cộng `+` hoặc **Install from file**).
   * Chọn file `hust-study-tracker.crx` đã tải ở Bước 2.
4. **Sử dụng**: Truy cập vào trang CTT-SIS và đăng nhập để sử dụng Dashboard tiện ích trên giao diện điện thoại.

---

## 💡 Hướng dẫn sử dụng

Đăng nhập vào trang quản lý đào tạo HUST tại địa chỉ:
```text
https://ctt-sis.hust.edu.vn/
```

Sau khi đăng nhập thành công, ở góc dưới bên phải màn hình sẽ xuất hiện 3 nút điều hướng nhanh:
* 🎓 **Quản lý học phần**: Tự động chuyển đến trang *Chương trình đào tạo* của bạn và mở Dashboard tiến độ học tập cùng các học phần còn thiếu.
* 📝 **Quản lý điểm số**: Tự động chuyển đến trang *Bảng điểm cá nhân* và hiển thị bảng xếp hạng điểm, bộ lọc học phần, tính năng cải thiện/dự đoán điểm.
* 📈 **Quản lý tổng quát**: Tự động chuyển đến trang *Bảng điểm cá nhân* và hiển thị biểu đồ GPA/CPA chi tiết qua từng kỳ học cùng các chỉ số cảnh báo học tập.

---

## 📂 Cấu trúc dự án

* `manifest.json`: File cấu hình và phân quyền của Chrome Extension (Manifest V3).
* `content.js`: Tập lệnh chạy ngầm trên trang SIS để quét cấu trúc bảng HTML và phân loại học phần.
* `ui.js`: Chứa toàn bộ logic xử lý giao diện, bộ lọc, tính toán CPA dự đoán và vẽ biểu đồ.
* `panel.html`: Chứa cấu trúc HTML Template của Dashboard và các bảng điều khiển.
* `styles.css`: CSS tạo kiểu giao diện hiện đại, trực quan (Dark/Light mode hỗ trợ).
* `hustlogo.png`: Icon chính thức của extension.

---

## 🔒 Cam kết bảo mật & Quyền riêng tư

* Tiện ích chạy **hoàn toàn cục bộ (local)** trong trình duyệt của bạn.
* Tiện ích **không có backend** và **không gửi bất kỳ thông tin nào** (mã số sinh viên, điểm số, chương trình học) của bạn ra máy chủ bên ngoài.
* Quyền truy cập được giới hạn nghiêm ngặt chỉ trong phạm vi tên miền `https://ctt-sis.hust.edu.vn/*`.