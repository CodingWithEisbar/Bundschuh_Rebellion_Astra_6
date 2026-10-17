# Bundschuh: Rebellion — demo chơi ngay

**Chọn nhiệm vụ:** [index.html](index.html) có 13 file HTML độc lập tương ứng
A1–A6, B1–B6 và prototype Joß Fritz; Godot F5 mở cùng danh sách mục tiêu. Các HTML
dùng chính menu, đồ họa isometric, HUD, camera và minimap của file skirmish.
Có khai thác, giao hàng, xây nhà/trại lính/kho, tuyển quân, giao chiến và thắng/thua
theo nhiệm vụ. H/B/C, Tab, V, Home, WASD và zoom giữ cách dùng của file mẫu.
Q/R/T chọn hero/dân cần cứu/xe và sứ giả. Mỗi file khoảng 4 MB, có bản AAC nhạc
menu nhúng sẵn, chạy offline. Đây chưa phải campaign GDD toàn cỡ. Xem
[hướng dẫn và phạm vi từng màn](../docs/CAMPAIGN_DEMOS.md).

Unit bị công trình che sẽ hiện đường viền theo dáng người, vũ khí hoặc xe:
xanh nhạt cho quân mình, cam cho quân địch, vàng cho trung lập. Viền chỉ hiện
trên phần bị mái/tường che và tự mất khi unit đi ra ngoài, không cần chọn unit.

**Demo skirmish kinh tế một file:** [bundschuh_rebellion.html](bundschuh_rebellion.html).
Các phần còn lại bên dưới mô tả riêng demo skirmish này.

Trên GitHub, mở file rồi chọn **Download raw file** ở góc phải. Lưu đúng đuôi
`.html`, sau đó mở bằng Chrome, Edge hoặc Firefox trên máy tính. Hoặc tải cả
repo bằng **Code → Download ZIP**, giải nén và mở file trong `demo/`.
Gameplay không cần Godot, server, Internet, tài khoản, package hay asset ngoài.
Nhạc M4A ở menu được nhúng sẵn trong HTML và cũng nghe được offline. Trang xem source của GitHub
không chạy HTML; cần tải file về trước.

Đã kiểm tra thực tế bằng Chromium/Edge, mở qua `file://` với network offline.
Firefox dùng API tiêu chuẩn tương thích nhưng chưa được kiểm thử riêng.

## Nhạc nền menu

M4A **Wir sind des Geyers schwarzer Haufen** do người dùng cung cấp trong
`sources/Wir sind des Geyers schwarzer Haufen.m4a` được nhúng nguyên bản dưới dạng
base64 trong HTML, với MIME `audio/mp4`. Chỉ cần mang theo một file HTML, không cần
file nhạc riêng, Internet, YouTube hoặc server. Bản gốc dùng codec ALAC; HTML cũng
nhúng bản AAC 192 kb/s chuyển từ cùng file để trình duyệt không hỗ trợ ALAC vẫn
phát được. Không đổi file nguồn. Nhạc lặp ở menu; trang tự yêu cầu phát mỗi lần mở menu.

**Toàn bộ khối nhạc và trình điều khiển được ẩn.** Nếu trình duyệt chặn tự phát có
tiếng, nhạc sẽ thử phát lại khi người chơi tương tác trong menu (ví dụ chọn phe
bằng chuột hoặc bàn phím). Browser policy vẫn quyết định có cho phép phát hay
không; không thể bảo đảm tự phát có tiếng trước mọi tương tác.

**Vào trận** hoặc ẩn tab sẽ dừng nhạc và giải phóng player, kể cả khi đang tải.
Khi quay lại menu/tab, nhạc tự tải lại từ đầu. Mất/có mạng không làm gián đoạn nhạc
đã nhúng. Nút **Âm** trong trận chỉ điều khiển âm báo gameplay.

Khối giới thiệu bên trái bay vào cùng nhau từ trái sang phải 180 px, đồng thời hiện
dần trong 1,6 giây. Hiệu ứng bắt đầu sau khi menu được vẽ lên màn hình, chạy lại
mỗi lần mở menu hoặc trở lại tab. Thiết lập
**Reduce motion** của hệ thống/trình duyệt sẽ hiển thị chữ ngay, không chuyển động.

## Trận đầu tiên

1. Chọn **Bundschuh** hoặc **Swabia**, nhập seed nếu muốn, rồi **Vào trận**.
2. Kéo chọn khoảng bốn dân, click phải bụi quả; cho hai dân lấy gỗ và hai dân
   lấy vàng. Chỉ tài nguyên giao về sở chỉ huy/kho mới cộng vào HUD.
3. Chọn một vài dân → **H** → click nền xanh để xây nhà, tăng 5 dân số.
4. Có thể tuyển thêm 2–4 dân tại **Sở chỉ huy** để tăng kinh tế. Chọn **Trại lính** (mái nhà có hai vũ khí bắt chéo), tuyển quân. Hàng chờ
   tính trước vào dân số; click một mục trong hàng chờ để hủy, hoàn toàn bộ giá.
5. Bundschuh nên có giáo chống Gendarme, Flailman đánh giáo và Preacher hỗ trợ.
   Swabia phối hợp Gendarme, Landsknecht và lính nỏ; giáo thường không tốn vàng.
6. Bundschuh nên gom khoảng 15–20 quân và giữ Preacher gần đội hình; thêm một
   trại lính để tận dụng quân rẻ. **Tab** chọn quân đội → **Tiến công** → click đường rừng để vừa đi vừa đánh.
   Quân đang đánh công trình sẽ giao chiến với địch gần đường trước.
   Dùng bản đồ nhỏ nhìn làng địch rồi click phải sở chỉ huy địch để phá hủy.
   Bảo vệ sở chỉ huy của mình: mất nó là thua.

Địch xuất quân lần đầu ở **2:30 thời gian game**. Nút **1×/2×** tăng tốc toàn bộ
trận, bao gồm đối phương. Có thể tạm dừng để ra lệnh hoặc đọc hướng dẫn.

## Điều khiển

| Thao tác | Điều khiển |
|---|---|
| Chọn đơn vị / nhóm | Click trái / kéo khung |
| Thêm hoặc bỏ khỏi nhóm | Shift + click; Shift + kéo để thêm |
| Di chuyển, khai thác, xây tiếp, tấn công | Click phải vào đất / tài nguyên / nền xây / địch |
| Xây nhà / trại lính / kho | Chọn dân rồi H / B / C |
| Hủy đặt công trình hoặc chọn điểm tiến công | Esc hoặc click phải |
| Tuyển dân / quân | Chọn sở chỉ huy / trại lính rồi click loại quân |
| Chọn quân đội / dân đang rảnh | Tab / V |
| Về sở chỉ huy | Home hoặc nút Về làng |
| Camera | WASD, phím mũi tên hoặc kéo chuột giữa |
| Zoom / xem nơi khác | Con lăn / click bản đồ nhỏ |
| Dừng lệnh / tạm dừng | X / Space |
| Hướng dẫn / chọn phe lại | Nút ? |

Rời tab hoặc cửa sổ sẽ tự tạm dừng. Trở lại rồi nhấn Space. Thiết kế cho chuột
và bàn phím, khuyến nghị cửa sổ từ 1024×768. Không có lưu trận; mở lại/reset
bắt đầu trận mới. Âm báo gameplay tắt mặc định, bật bằng nút **Âm**. Nhạc menu
tự phát và không có điều khiển hiển thị.

## Phạm vi bản demo

Đây là **bản gameplay độc lập bằng Canvas 2D/JavaScript**, không phải Godot Web
export và không thay thế source Godot của Stage 1–5. Một file chứa giao diện,
đồ họa vẽ bằng mã, nhạc M4A menu, âm báo tổng hợp và snapshot JSON base stats của repo.

Có hai phe điều khiển được, map rừng có seed, chọn/kéo quân, A* tám hướng không
cắt góc, hàng đợi path budget, tránh va chạm cục bộ, bốn tài nguyên hữu hạn,
cargo, kho giao hàng, placement, construction, recruitment, counters, aura,
AI có kinh tế, thắng/thua và chơi lại. Mô phỏng fixed tick 20 Hz; render không gây
damage. Đòn cùng tick được gộp trước khi xử lý chết. Preacher chỉ buff, không heal.

**Thông số riêng cho trận demo** (không ghi đè JSON/GDD):

| Hạng mục | Thiết lập |
|---|---|
| Bản đồ | 42×30, phẳng, ba đường chính rộng 3 ô; không xây đè đường được bảo vệ |
| Tầm xây | Trong 12 ô quanh công trình hoàn tất cùng phe |
| Tài nguyên người chơi | 450F / 400W / 260G / 100S |
| Tài nguyên AI | 400F / 250W / 250G / 0S; thu và chi thật, không sinh tài nguyên miễn phí |
| Dân xuất phát | 8 mỗi phe, TC + một trại lính; TC cấp 20 housing |
| Quân Bundschuh xuất phát | 3 Flailman, 2 Pikeman, 1 Preacher |
| Quân Swabia xuất phát | 1 Gendarme, 2 Landsknecht, 1 Crossbowman |
| Giới hạn | 100 dân số mỗi bên; hàng chờ tối đa 8 mỗi công trình |
| Kinh tế | 2 tài nguyên/giây làm việc, mang 10; Bundschuh +10% Food/Wood; thời gian đi/giao thật |
| Kho | 100W, 30 giây công, 500 HP; nhận cả bốn loại |
| Nhà | 25W, 25 giây công, 400 HP, +5 housing |
| Trại lính | 175W, 40 giây công, 900 HP |
| Sở chỉ huy | 1800 HP; không xây thêm trong demo |
| Giáp công trình | 2 melee / 4 pierce; không tự bắn |
| Tuyển quân | Giá, thời gian và base combat stats nguyên từ JSON; không có age gate/tech upgrades |
| Nhịp AI | Bắt đầu đặt lệnh tuyển ở giây 35; tối thiểu 30 giây giữa hai lệnh tuyển; vẫn chờ đủ train time |
| Đợt tấn công | Từ giây 150; kiểm tra mỗi 95 giây, gửi tối đa 5 quân chưa có lệnh đánh HQ nếu có ít nhất 3 |

Toàn bộ map được hé lộ. Không có multiplayer, save/load, bốn Age, fog of war,
stealth campaign, payroll, Zeal/Fear, cao độ, LOS đạn qua cây, pháo binh, công
thành hoặc asset/giọng Đức production. Đạn nỏ là hit tức thời với vệt hình ảnh.
Stone có thể khai thác/giao kho để thử vòng economy, chưa có công trình tiêu Stone.
Nhà bị phá hủy mất hàng chờ và chi phí đã trả; tự hủy hàng chờ mới hoàn tiền.
Dân/đơn vị bị hạ mất cargo. Nền xây bắt đầu 0 HP nhưng tồn tại cho tới khi bị đánh.

Tránh va chạm ở đây dùng một bán kính thử nghiệm 0.18 ô cho tất cả quân và
steering tại chỗ, không phải controller quân sự production cho siege/cavalry
khác kích cỡ. Kiểm tra mixed-speed crowd trong demo không thay bộ regression
200 quân của Godot. Đây là scenario thử gameplay, không chứng minh cân bằng ranked.

## Sửa chỉ số và kiểm tra

Nguồn combat stats duy nhất vẫn là `data/balance/units.v1.json`. Sau khi sửa:

```sh
python3 tools/sync_browser_demo.py
python3 tools/sync_browser_demo.py --check
node tests/browser_demo_model.cjs
node tests/browser_missions_model.cjs
```

Lệnh sync dùng validator hiện tại và nhúng JSON/hash vào HTML; không sửa tay block
`balance-data`. Refresh/mở lại demo để dùng snapshot mới. Không có hot reload
browser. Thay model/presentation trực tiếp trong HTML, giữ ranh giới `MODEL_END`
để runner Node kiểm tra đúng model nhúng thay vì một bản mô phỏng viết lại.

Kiểm tra UI tùy chọn cần Playwright + Chromium trên máy phát triển:

```sh
# Cài công cụ ở ngoài repo hoặc workspace phát triển; game không phụ thuộc chúng.
# Đặt PLAYWRIGHT_MODULE nếu module không nằm trong Node resolution path.
node tests/browser_demo_ui.cjs
node tests/browser_demo_music.cjs
node tests/browser_missions_rts_ui.cjs
```

Runner mở file offline, thao tác chuột/phím, kiểm tra HUD, xây/tuyển quân, camera,
audio, pause, đổi phe, thắng/thua và chụp 1440×900 / 1024×768. Chỉ URL có `?test=1`
mới bật hook điều khiển cho kiểm thử. Screenshot/report vào `test-results/`, không
commit. Cấu hình `BROWSER_EXECUTABLE` cho binary Chromium riêng nếu cần.

Bộ kiểm tra Godot vẫn giữ nguyên:

```sh
python3 tools/verify.py --godot /path/to/Godot_v4.5.2-stable_linux.x86_64
```

API tham khảo: [Canvas 2D (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
và [Playwright configuration](https://playwright.dev/docs/test-use-options).
