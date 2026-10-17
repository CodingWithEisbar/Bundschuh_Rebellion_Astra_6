# Gameplay demo — validation

## Mission demos — 2026-10-18

- `node tests/browser_occlusion_ui.cjs`: **57 checks passed**, so sánh pixel
  renderer thật của skirmish và cả 13 nhiệm vụ qua `file://` offline. Unit sau
  mái/tường có viền theo dáng người, vũ khí, ngựa hoặc xe; unit phía trước,
  unit chết, nền xây và nhà đã mất không sinh viền. Vòng chọn, aura, thanh máu
  không bị đưa vào đường viền. Đã xem ảnh kỵ binh và xe sau sở chỉ huy.
- `node tests/browser_demo_ui.cjs`: **26 checks passed** lại trên Edge offline.
- `node tests/browser_missions_model.cjs`: **51 cases passed**, chạy model thật
  trong từng HTML, khởi tạo và đi qua mục tiêu tới trạng thái thắng của đủ 13 màn
  bằng fixture, cùng các ca thua/mất xe/tù binh/detection/payroll và di chuyển thật.
  Kiểm tra thêm vòng khai thác/giao Food bảo toàn tài nguyên ở cả 13 màn; CSS,
  projection isometric và renderer công trình dùng trực tiếp từ file mẫu.
- `node tests/browser_missions_rts_ui.cjs`: **290 checks passed**, Edge qua
  `file://` với network offline. Cả 13 màn dùng menu hai cột, HUD, minimap, camera
  và zoom của file mẫu. Thao tác thật: click phải khai thác và giao hàng; H + click
  dựng foundation, dân đi xây hoàn tất và tăng housing; Home chọn TC, trả giá và
  chờ đủ thời gian tuyển dân; B/C giữ phím xây cũ, V vẫn chọn thợ, Q chọn hero.
  Player nhạc menu ẩn được tạo một lần, giải phóng trước gameplay. Bố cục
  1440×900/1024×768, hook chỉ bật với `?test=1`; không lỗi JS/HTTP request.
- `node tests/browser_demo_model.cjs`: **17 cases passed**, gồm bảo toàn tài
  nguyên và mixed-speed crowd cũ. `sync_browser_demo.py --check`: 14 file
  nhiệm vụ/index và snapshot combat đều khớp nguồn.
- Godot 4.5.2: `campaign_tests.gd` **38 cases passed**, có đủ 13 đường hoàn
  thành mục tiêu, đổi scene, layout, actual-center navigation, tiếp tục lệnh sau
  giao chiến, giữ vị trí, nguồn Food thật và nonlethal surrender. Đã xem ảnh render
  thực tế của menu và trận Godot. Với HTML đã xem ảnh menu A3 sau hiệu ứng vào,
  cảnh làng/quân isometric A1/A3/A6/B4/B5 và A3 ở 1024×768.
- Gate `tools/verify.py --godot …4.5.2…`: **145 integration cases passed**,
  gồm Stage 1–5, campaign, Python parser/reload, balance 10×, các backend demo,
  HUD/input và cảnh khởi động mới. Không có script/runtime error hoặc resource leak.

Các ca thắng dùng vị trí/HP fixture để kiểm tra logic mục tiêu, không phải bot
chơi tự nhiên hoặc bằng chứng mức khó/cân bằng của cả campaign. Phạm vi và
những cơ chế GDD còn thiếu ghi ở [CAMPAIGN_DEMOS.md](../docs/CAMPAIGN_DEMOS.md).

## Skirmish — lần kiểm tra trước

Kiểm tra ngày 2026-10-12. Đây là kiểm tra bản Canvas độc lập; không nâng phạm vi
cam kết của military navigation, campaign hoặc balance trong Godot.

| Kiểm tra | Kết quả |
|---|---|
| `python3 tools/sync_browser_demo.py --check` | Snapshot 10 units/hash khớp JSON gốc |
| `node tests/browser_demo_model.cjs` | **17 cases passed** |
| `node tests/browser_demo_ui.cjs` với Playwright | **26 checks passed**, Chromium 153.0.8010.0 |
| `python3 tools/verify.py --godot …4.5.2…` | **107 integration cases passed**, Godot Stage 1–5 + Python |

Model tests chạy chính phần mô phỏng lấy từ HTML: seed/corridor connectivity,
A* không cắt góc, tài nguyên hữu hạn/bảo toàn cargo khi đổi lệnh, construction
sau khi đến nơi, housing hoàn tất một lần, placement, chi phí/hoàn tiền/housing
hàng chờ, khóa roster, counters, aura không stack/expire, lethal trade cùng tick,
không reset cooldown bằng lệnh, tiếp cận unit/công trình không mắc ngoài tầm,
giữ vị trí, terminal state và 36 quân có tốc độ khác nhau đi qua rừng.

UI kiểm tra mở bằng `file://` trong browser context **offline**; toàn bộ request
quan sát được đều là file HTML cục bộ. Không có lỗi JavaScript. Đã thao tác kéo
chọn, click phải lấy tài nguyên, H + click xây nhà, chọn trại lính và tuyển quân,
đọc HUD, pause/help, speed, chọn quân đội, camera/minimap/Home, âm báo, reset,
đổi phe/seed và thắng/thua. Hai terminal UI dùng fixture HQ 1 HP, rồi xử lý bằng
combat tick thật; không coi chúng là bằng chứng win rate/cân bằng. Khung nhìn
1440×900 và 1024×768 đã được chụp và kiểm tra trực quan.

File ảnh/report tạm nằm trong `test-results/browser-demo/` và không được commit.
Runner UI cần Playwright và Chromium ở máy phát triển; người chơi chỉ cần HTML.
Các lượt screenshot đầu gặp timeout ở Chromium serverless khi chụp nhiều ảnh
liên tiếp; lượt cuối giảm ảnh dư, giữ kiểm tra hành vi đầy đủ và cả hai kích
thước, hoàn tất toàn bộ 26 checks. Chưa kiểm thử riêng Firefox/Edge, mobile,
multiplayer, save/load hay performance trên máy cấu hình thấp.

## Nhạc menu — bản bật thủ công ban đầu, 2026-10-13

Đã thêm video `pMLeQAPhHN8` qua player YouTube chỉ tải khi người dùng bật.
`tests/browser_demo_music.cjs` đạt **19 checks** trong Chromium: mặc định không
request YouTube, offline vẫn vào trận được, nút dùng được bằng Space, URL/loop
đúng video, player tối thiểu 200×200, referrer HTTP thật, bật/tắt, hủy khi đang
load, trở về menu không phát trùng, dừng khi ẩn trang/mất mạng và bố cục 1440×900,
1024×768. Bộ 17 model cases và 107 Godot/Python integration cases đã chạy lại,
đều đạt.

Lệnh chạy cùng cấu hình Playwright như UI runner:

```sh
node tests/browser_demo_music.cjs
```

Runner dùng response iframe giả được ghi nhãn rõ để kiểm tra adapter/giao diện.
**Chưa xác nhận live audio hoặc quyền nhúng của video trên YouTube.** Báo cáo và
ảnh ở `test-results/browser-demo-music/`; ảnh fixture không phải ảnh video thực.
Không coi trạng thái đã mở iframe là đang phát nhạc. Hướng dẫn có cách chạy HTTP
cho lỗi referrer 153 và liên kết mở video trực tiếp nếu player không phát.

## Nhạc ngay khi mở menu — 2026-10-13

Theo yêu cầu tiếp theo, player giờ tự tải khi menu bắt đầu hiển thị và có mạng,
với `autoplay=1`. Player có nút Play thật để người dùng bấm nếu trình duyệt chặn
tự phát có tiếng. Không coi việc tải iframe là bằng chứng nhạc đã phát.

`tests/browser_demo_music.cjs` đã chạy lại và đạt **30 checks**, gồm mở HTML
offline, tự tạo một player khi vào menu online, loop đúng bài, keyboard Space,
hủy player khi vào trận/ẩn trang/mất mạng, tự khôi phục khi trở lại menu/tab/có
mạng, không phát trùng, và giữ lựa chọn Tắt nhạc qua mọi lần chuyển đó. Bố cục
1440×900 và 1024×768 đã được chụp và xem lại. **17 model cases và 107 Godot/Python
integration cases đều đạt** trong lần cập nhật này.

YouTube vẫn được thay bằng response giả có nhãn trong bài kiểm tra browser.
**Chưa xác nhận âm thanh YouTube thực tế hoặc quyền nhúng của video.** Nhạc cần
Internet; gameplay vẫn chơi offline. File mở trực tiếp có thể cần hướng dẫn
HTTP/localhost trong README nếu YouTube trả lỗi 153.
