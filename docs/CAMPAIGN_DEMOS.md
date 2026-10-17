# Demo nhiệm vụ HTML và Godot

## Mở và chơi

- **HTML:** mở `demo/index.html`; chọn bất kỳ A1–A6, B1–B6 hoặc P0. Từng HTML là
  một file độc lập, hoạt động qua `file://`, không cần server/Internet. Trang index
  và các liên kết chuyển màn cần những file tương ứng nằm cùng thư mục.
  Toàn bộ menu, CSS, renderer isometric, điều khiển và HUD lấy từ
  `bundschuh_rebellion.html`; chỉ bổ sung dữ liệu/mục tiêu và nhóm nhân vật nhiệm vụ.
- **Godot 4.5.2 Standard:** import `project.godot`, F5, chọn màn, đọc briefing và
  bắt đầu. Scene mặc định là `scenes/campaign.tscn`. `scenes/main.tscn` vẫn là
  sandbox kinh tế/navigation cũ và có nút quay lại Campaign.

Click hoặc kéo để chọn, Shift để thêm nhóm. Click phải di chuyển hoặc tấn công
đối tượng địch. Quân chiến đấu tự giao chiến với địch gần; hero/xe không tự đánh.
**HTML:** Tab chọn quân; V chọn thợ rảnh; H/B/C xây nhà/trại lính/kho. WASD hoặc
kéo chuột giữa để di chuyển camera; con lăn zoom; Home về sở chỉ huy. Q chọn hero,
R dân cần cứu/courier, T xe/sứ giả/tù binh. Click TC/Barracks để tuyển; click hàng
chờ để hủy và hoàn tiền. Khai thác chỉ cộng tài nguyên khi giao về kho. Đầu trận
chọn sẵn tám thợ thật; hero và dân nhiệm vụ không trở thành thợ xây/khai thác.

**Godot tactical:** Tab chọn quân, Q hero, V dân/courier, C xe/sứ giả/tù binh.
Trong cả hai bản, X dừng lệnh, Space
tạm dừng. Chọn nhóm nhỏ khi lối đi đông. Điểm chiếm cần ba quân chiến đấu trong
bán kính 3 ô và không có quân địch trong 4 ô, liên tục 6 giây. Sau đó giữ đủ
thời gian trên bảng mục tiêu; contested tạm dừng capture, bỏ trống giảm 2s/s.
Thời gian giữ của mục tiêu bị reset khi chưa đủ số điểm thuộc quyền mình.

Người trung lập có màu vàng; tiến tới trong 2,5 ô để họ gia nhập, rồi chọn dân
đưa về cửa thoát. Việc giải cứu chỉ đếm các ID mang nhãn trong scenario. Đứng
gần cửa 2,4 ô sẽ sơ tán, không teleport từ xa. B2: click phải bàn đàm phán để
đưa sứ giả tới. **HTML: Alt + click phải khu trung lập** là lệnh chủ động phá đình
chiến; Godot tactical dùng A + click phải. HTML giữ A cho camera như file mẫu.
Lệnh này gây thất bại, đã cảnh báo ở phần hướng dẫn.

## Các màn và nguồn

| Màn / HTML trong `demo/` | Nội dung thử được |
|---|---|
| `p0_secret_oath.html` | Joß Fritz, ba liên lạc và cửa rừng; detection Stage 3 |
| `a1_the_secret_oath.html` | Ba cuộc họp, năm nhóm tổng 20 người; hai hero + 12 người thoát cùng cửa |
| `a2_the_twelve_articles.html` | Hai trong ba cộng đồng; 12 dân, ba kiện in, ít nhất một xưởng còn sống |
| `a3_the_eternal_council.html` | Ba khu phố, transaction 600 Food, hai trong ba xe tới chợ |
| `a4_the_call_to_allstedt.html` | Chọn hai tuyến, mỗi tuyến cấp một sứ giả + 12 quân đúng một lần; cứu 16 quân từ một cặp tuyến hợp lệ |
| `a5_the_rainbow_road.html` | Müntzer, Anna và hai trong ba xe tới trại |
| `a6_frankenhausen.html` | Giữ Banner; cứu Anna, 24/40 dân và 3/5 courier trước hạn |
| `b1_quenching_the_sparks.html` | Hai xe tiếp tế, hai vị trí hỏa lực, cổng đầu hàng và payroll |
| `b2_the_weingarten_accord.html` | Bảo vệ hậu cần, tiếp tế, sứ giả đàm phán rồi trở về; đình chiến |
| `b3_battle_of_boblingen.html` | Hai cao điểm, ba chốt pháo, đánh bật hai Haufen |
| `b4_after_weinsberg.html` | Đồi/hành chính, hai chỉ huy đầu hàng và được hộ tống, hai máy in |
| `b5_guns_of_konigshofen.html` | Ba cầu cố định, chiếm hai lối vượt, ba trong bốn chốt pháo, khu chỉ huy |
| `b6_the_last_haufen.html` | Hai trạm liên lạc, ba trại, quân nhu; sứ giả địch đổi thời điểm phản công |

Briefing, tên/địa điểm và kết thúc dựa trên `docs/gdd/BUNDSCHUH_REBELLION_GDD_PHASE_3.md`.
Giữ sự khác nhau giữa thiết kế gameplay và lịch sử: Anna là nhân vật hư cấu;
Frankenhausen dùng **Princely Host**, không đưa Waldburg tới đó; thắng A6 là cứu
người, không đảo ngược thất bại hay số phận Müntzer. P0 không gán Joß Fritz cho
Allstedt hoặc Frankenhausen.

`data/missions/campaigns.v1.json` là manifest dùng chung: mục tiêu, vị trí,
briefing, khởi đầu, kết thúc và HP/giáp của proxy công trình. `secret_oath_default.tres`
vẫn là nguồn tham số detection. A1 giữ nhân vật/địa điểm của GDD, nhưng dùng
**detection Stage 3** thay toàn bộ Alert/chase: một đồng hồ, hợp các guard, đầy
2 giây tính một episode, thoát hết LOS 2 giây và meter 0 mới rearm, lần thứ ba
thua. P0 dùng nguyên protagonist `joss_fritz`; A1 dùng config bản sao với ID Müntzer.
LOS là vùng tròn được author và di chuyển tuần tra, không occlusion qua cây/tường.

## Phạm vi rút gọn được công bố

HTML là **13 RTS mission demos** trên nền file skirmish gốc. Bản Godot hiện là
cảnh tactical giới thiệu trước đó. Cả hai dùng cùng mục tiêu, briefing và kết
thúc; HTML bổ sung vòng kinh tế/xây dựng của file mẫu. Chưa phải toàn bộ campaign
Phase 3. Hai runtime có engine, giao diện và mô hình di chuyển khác nhau, không
hứa kết quả combat từng tick giống hệt nhau.

- Map 42×30, ba đường chính; hình làng/rừng/sông/cao điểm vẽ bằng mã, không phải
  bản đồ lịch sử đúng tỷ lệ hoặc RMS ranked. Seed cục bộ 1524, generation hữu hạn.
- Capture 6s thay 30s; các mốc giữ 60/90s thành 12/18s. B2 15 phút thành 150s;
  A6 3 phút chuẩn bị + 18/24 phút chiến đấu thành 15 + 180/240 giây. Hoàn tất
  giữ Banner không bị thu hồi nếu Banner bị phá sau mốc 195 tổng giây game.
- Lính thường dùng nguyên base snapshot `data/balance/units.v1.json`, gồm
  Gendarme 125 HP. Hero, xe, courier và tù binh là thân Villager không có đòn
  đánh, không có stat/skill hero hoặc xe riêng. Công trình nhiệm vụ là proxy
  tĩnh: 600 HP bảo vệ, Banner 1200 HP, mục tiêu địch 180 HP; giáp 2/4.
- Chốt pháo chỉ là mục tiêu có HP, **không bắn**, không đại diện cho cannon đã
  hoàn thiện. Không có pack/unpack, sửa xe, Age/tech, toàn bộ Zeal/Fear/Frenzy,
  máy in buff sản xuất, Market, fog of war, garrison hay campaign persistence.
- **HTML:** có TC, Barracks, hai nhà và tám thợ; rừng, Food, Gold, Stone hữu hạn;
  dân mang/giao cargo thật. Xây House/Barracks/Camp và tuyển/cancel queue dùng
  nguyên model của file mẫu. Hai nhà cấp 10 housing ngoài TC; đạo quân lớn được
  cấp thêm sức chứa scenario lúc đầu. Nhà mới hoàn tất tăng 5, cap tối đa 100.
  Mỗi công trình có hàng chờ tối đa 8; nhận dân/quân viện phải chờ đủ housing.
  Địch có sáu thợ, kho và tuyển quân trả giá thật, cùng AI của file skirmish.
  Các giá trị riêng nằm ở `data/missions/browser_rts.v1.json`, không sửa balance.
- **Godot tactical:** tuyển từ bảng trại với cùng base cost/train time, hàng chờ
  8 và cap 100; không khai thác/xây nhà trong các màn tactical. Chọn sandbox để
  thử kinh tế. Hai bản đều cấp 900F/900W/900G/200S như ngân sách scenario, không
  phải opening/cân bằng GDD.
- Payroll **chỉ bật trong các màn B**: mỗi 30s trừ 1G/Landsknecht, về 0 đổi
  ownership sang thù địch. Không đưa grace/hợp đồng 120s GDD cũ vào backend Stage 2.
  Aura Preacher vẫn 6 ô / +15% attack rate và movement; cao độ +25% sau counter.
- Viện quân được cấp bởi trigger hữu hạn, báo trước 45s từ mép Đông; tối đa 3
  đợt thường hoặc 6 đợt A6. Ngoài các grants này, HTML có AI kinh tế/tuyển quân
  thật: bắt đầu tuyển từ giây 35, tấn công căn cứ từ 150s như bản mẫu. P0/A1
  giữ stealth và chỉ cho thợ AI hoạt động; không tự bật các đợt đánh căn cứ.
- HTML nhiệm vụ nhúng **bản AAC của cùng bài nhạc menu**, khoảng 4 MB/file. Giữ
  player ẩn, autoplay/retry sau tương tác, dừng/giải phóng khi vào trận hoặc ẩn tab,
  không phụ thuộc mạng. File gốc vẫn giữ nguyên ALAC/M4A và AAC. Hiệu ứng giới
  thiệu bay từ trái và reduced motion dùng chính CSS/lifecycle của file mẫu.

Godot dùng `CampaignBattle` → `RtsSimulation.step()` → `CombatWorld` và
`MissionTriggerManager`, chung clock 20 Hz, ResourceBank thật. Adapter quân sự
riêng dùng A* tối đa 6 query/tick, vị trí tâm liên tục, kiểm tra circle sweep với
các body và terrain. Lính dùng radius từ JSON, không đổi traffic dân Stage 1.
Đây chưa phải military navigation đầy đủ cho siege/cavalry khác clearance; các
proxy tĩnh và crowd lớn có thể cần chia nhóm khi đi chật. HTML tái dùng trực tiếp
model `Game` của skirmish, thêm adapter mục tiêu; không viết lại combat trong Python.

Tù binh B4 dùng `CombatUnit.damage_floor_hp` chỉ cho objective chỉ huy: batch damage
không hạ dưới 25%, chuyển trung lập và cần người hộ tống 6s trước khi spawn captive
có ID riêng. Quân bình thường có floor 0, giữ nguyên lethal trades cùng tick.
Người đã thoát được lưu ID ở host và rời combat registry, không giữ payroll/pop.

## Sửa và kiểm tra

Chỉnh manifest, `browser_rts.v1.json`, `demo/src/mission_model.js`,
`mission_rts_ui.js`, `mission_style.css`, rồi:

```sh
python tools/sync_browser_demo.py
python tools/sync_browser_demo.py --check
node tests/browser_demo_model.cjs
node tests/browser_missions_model.cjs
python tools/verify.py --godot /absolute/path/to/Godot_4.5.2
```

Không sửa tay các HTML nhiệm vụ đã generate. Generator validate shared balance,
nhúng source hash, toàn bộ màn hình/renderer/controls/model skirmish thật, mission
JSON, config `.tres`, luật RTS riêng và nhạc AAC vào từng file. Các integration
marker được kiểm tra; khi file gốc đổi cấu trúc, generator báo lỗi để cập nhật.
Giữ `MODEL_END` để Node runner kiểm tra đúng model chạy trong browser. Hook UI
chỉ có khi `?test=1`. UI tùy chọn: `node tests/browser_missions_rts_ui.cjs`, với
`PLAYWRIGHT_MODULE` và `BROWSER_EXECUTABLE` nếu công cụ ở ngoài repo.

Gate Godot tạo mới `test-results/campaign.json` ngoài các report Stage 1–5;
wrapper kiểm tra cả script errors ngay cả exit 0. Ảnh/report, runtime và mọi npm
package nằm ngoài tracked source. Các `.gd.uid` đi cùng script mới.
