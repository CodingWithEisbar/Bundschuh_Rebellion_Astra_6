# Bundschuh: Rebellion

**Stage 1 — Core RTS Prototype & Pathfinding**
**Stage 2 — Combat Matrix & Asymmetrical Mechanics (backend)**
**Stage 3 — Procedural Maps, High Ground & Mission Triggers**
**Stage 4 — Asset Integration, Animation & Audio**
**Stage 5 — Data-Driven Balance, Headless Arena & Runtime Reload**
Engine được ghim: **Godot 4.5.2 Standard**, GDScript có kiểu dữ liệu. Mở project và chạy ngay, không cần .NET, asset pack hoặc plugin trả phí.

F5 hiện mở **menu 13 nhiệm vụ chơi được**: A1–A6, B1–B6 và prototype Joß Fritz.
Chọn màn → đọc briefing → **Bắt đầu nhiệm vụ**. Godot có bản đồ vẽ cảnh làng/rừng,
quân hai bên, chọn/kéo quân, giao chiến, hộ tống, giữ điểm và thắng/thua theo mục
tiêu. Nút **Sandbox kinh tế Stage 1–5** mở lại cảnh thử khai thác/xây dựng cũ.
Đây vẫn là prototype top-down vẽ bằng mã, chưa phải art isometric hoặc campaign
toàn cỡ. [Phạm vi và hướng dẫn nhiệm vụ](docs/CAMPAIGN_DEMOS.md).

## Demo các nhiệm vụ — mở HTML offline

Mở [demo/index.html](demo/index.html) để chọn màn, hoặc tải riêng một HTML nhiệm vụ
trong `demo/` rồi mở trực tiếp. Có **13 file độc lập**, mỗi file khoảng 4 MB,
dùng trực tiếp giao diện và renderer isometric của `bundschuh_rebellion.html`:
menu biên niên sử, HUD tài nguyên, làng, quân đội, camera và minimap. Có đầy đủ
khai thác, giao hàng, xây nhà/trại lính/kho và tuyển quân bằng H/B/C như file mẫu.
Nhạc menu AAC nhúng sẵn; không cần Godot, server, Internet hay asset ngoài.
Dữ liệu mục tiêu dùng chung với
Godot từ [campaigns.v1.json](data/missions/campaigns.v1.json). Briefing ghi rõ các
mốc thời gian/đạo quân rút gọn và những tính năng GDD chưa có.

## Demo một file — mở và chơi ngay

Tải [demo/bundschuh_rebellion.html](demo/bundschuh_rebellion.html) bằng **Download raw file**
trên GitHub, rồi mở file HTML bằng trình duyệt máy tính. Không cần cài Godot hoặc
chạy server. Có hai phe, economy, xây nhà, tuyển quân, AI, minimap và thắng/thua. Menu có
nhạc M4A được nhúng sẵn, tự phát khi mở menu và dừng khi vào trận, nghe được offline.
Phần điều khiển nhạc được ẩn; nếu trình duyệt chặn tự phát, tương tác trong menu
(ví dụ chọn phe) để phát nhạc. Chữ giới thiệu hiện dần mỗi lần mở menu.

Đây là bản gameplay Canvas độc lập dùng base stats JSON của repo, không phải bản
export Godot. [Hướng dẫn và phạm vi demo](demo/README.md) có điều khiển, thông số
trận thử và cách đồng bộ dữ liệu. Source Godot và các bước chạy bên dưới vẫn giữ nguyên.

## Chạy trong 5 bước

1. Tải [Godot 4.5.2 Standard](https://godotengine.org/download/archive/4.5.2-stable/) cho Windows/macOS/Linux.
2. Clone repo hoặc chọn **Code → Download ZIP**, sau đó giải nén.
3. Mở Godot → **Import** → chọn **project.godot** trong thư mục repo.
4. Chờ Godot import scripts rồi nhấn **F5** → chọn nhiệm vụ → **Bắt đầu nhiệm vụ**.
5. Click/kéo chọn; click phải ra lệnh. **Tab** chọn quân, **Q** hero, **V** dân,
   **C** xe/sứ giả, **Space** tạm dừng, **Esc** về danh sách nhiệm vụ. Muốn thử
   khai thác/xây nhà, chọn **Sandbox kinh tế Stage 1–5** từ menu.

Nếu dùng Git:

    git clone https://github.com/CodingWithEisbar/Bundschuh_Rebellion.git
    cd Bundschuh_Rebellion

Không cần export templates để chạy bằng editor. Repo không chứa binary của engine.

## Đã triển khai

| Hệ thống | Chức năng |
|---|---|
| Grid & navigation | Native A*, bốn hướng, không cắt góc; hàng đợi giới hạn số query; cache; cập nhật khi thêm/bỏ vật cản |
| Crowd traffic | Ô đích riêng, quyền chiếm ô độc quyền, hàng đợi có ưu tiên chờ, nhường đường, chuyển động đối đầu phối hợp |
| Economy | Food/Wood/Gold/Stone hữu hạn; cargo; capacity; chuyển tài nguyên vào kho bằng transaction khi giao hàng |
| Villager AI | Idle → MoveToResource → Gather → ReturnToDropoff; trạng thái chờ, xây dựng, đổi nhiệm vụ và xử lý mục tiêu mất |
| Placement | Snap theo grid; xanh BUILD / đỏ BLOCKED; kiểm tra footprint, quân đang đi, tài nguyên, chi phí và đường tiếp cận |
| Construction | Foundation bắt đầu 0 HP; nhiều dân đóng góp công; tăng tới MaxHP; completion phát một lần |
| Combat backend | Damage M/P + armor-class counters; Pike +25 Cavalry; attack cooldown và damage cùng tick |
| Zeal aura | Spatial hash mỗi 1s, bán kính 6 ô; +15% attack rate/movement speed cho đồng minh, không stack |
| Mercenary payroll | Scenario opt-in, mỗi 30s trừ Gold/Landsknecht; kho về 0 thì đổi ownership sang hostile và emit DesertionEvent |
| Black Forest | Map theo seed, cellular automata, ba hành lang hẹp, cây khai thác được và mỏ Gold/Stone có đường tiếp cận |
| High ground | +25% sau armor/counter; cao độ riêng với tọa độ màn hình; kiểm tra footprint phẳng khi xây |
| Stealth backend | Joß Fritz, thanh detection, fail sau 3 episode; Area2D adapter và events, cấu hình qua Resource |
| Drop-offs | Town Center nhận cả bốn loại; Mill nhận Food; Lumber Camp nhận Wood; Mining Camp nhận Gold/Stone |
| HUD & input | Chọn/kéo chọn/Shift, lệnh theo ngữ cảnh, minimap, camera, pause, tốc độ 1×/4×, progress/HP/cargo |
| Animation/audio lab | F9: Idle/Run/Attack/Die, wind-up/contact đồng bộ, adaptive music, voice routing theo phe, caption và pool |
| Balance tools | JSON/schema, reload có revision, arena 100 Flailmen vs 20 Gendarmes ở 10×, JSON/CSV và Python CLI |
| Verification | Tests chạy bằng Godot thật; kiểm tra 200 quân qua choke một ô, đi ngược chiều, bảo toàn tài nguyên và construction |

## Điều khiển sandbox kinh tế

| Thao tác | Phím / chuột |
|---|---|
| Chọn dân / chọn nhiều | Click trái / kéo khung |
| Thêm hoặc bỏ khỏi selection | Shift + click/kéo |
| Chọn tất cả dân | Ctrl+A hoặc nút Select all |
| Di chuyển / khai thác / xây tiếp | Click phải đất / resource / foundation |
| Giao cargo | Click phải công trình nhận tài nguyên; chọn điểm nhận phù hợp gần nhất |
| Đặt House / Mill / Lumber Camp / Mining Camp | H / J / K / L |
| Xác nhận / hủy preview | Click trái / Esc hoặc click phải |
| Dừng nhiệm vụ, giữ nguyên cargo | X |
| Camera / zoom | WASD hoặc kéo chuột giữa / con lăn |
| Điều hướng qua minimap | Click trái minimap |
| Pause / resume | Space |
| Xem tối đa tám route được chọn | Tab |
| Reset sandbox 16 dân | F6 |
| Reset stress scenario 200 dân | F7 — tự ra lệnh vượt đường rừng |
| Tạo Black Forest theo seed | Nhập ô seed → F8 / nút Forest / Enter |
| Animation & Audio Lab | F9; F6 trở về sandbox mới |

F6/F7/F8 **reset toàn bộ sandbox hiện tại**. F9 đổi sang scene lab và cũng bỏ tiến độ sandbox. Demo cấp sẵn tài nguyên và housing để thử hệ thống; đây không phải opening skirmish tiêu chuẩn trong GDD. Chưa có lưu game.

## Thử ba vòng gameplay

**Di chuyển đông quân:** nhấn F7, quan sát 200 dân đi qua khe rừng rộng một ô và tập kết ở bên phải. Dùng Tab để xem đường, nút Speed để tăng tốc. Chọn nhóm ở hai phía và ra lệnh đi ngược chiều để quan sát nhường đường.

**Khai thác:** nhấn F6, chọn vài dân rồi click phải cây hoặc resource có chữ F/G/S. Chọn riêng một dân để đọc cargo. Cargo đầy hoặc node hết thì dân giao hàng; HUD chỉ tăng khi giao xong. Dân giữ cargo và chờ nếu không có drop-off đã hoàn tất và đi tới được.

**Xây dựng:** chọn dân → H/J/K/L → di chuột trên grid. Xem lý do BUILD/BLOCKED ở HUD. Click vị trí hợp lệ; chi phí được trừ đúng một lần, HP khởi đầu bằng 0. Có thể chọn thêm dân và click phải foundation để xây nhanh hơn. House hoàn tất tăng 5 housing; camp chỉ nhận tài nguyên khi hoàn tất.

## Chạy kiểm thử

Cần Python 3.10 trở lên và Godot 4.5.2; không cần package Python bổ sung.

Windows PowerShell, thay đường dẫn bằng vị trí Godot thực tế:

    $env:PYTHONUTF8 = "1"
    $env:PYTHONIOENCODING = "utf-8"
    python tools/verify.py --godot "C:\Tools\Godot\Godot_v4.5.2-stable_win64.exe"

Linux/macOS:

    python3 tools/verify.py --godot /path/to/godot

Lệnh thực hiện import/compile, regression tests cả năm stage, 13 mission demos,
Python parser/live-reload, trận balance 10×, ba backend demo, HUD và main-scene
smoke test. Report JSON nằm trong **test-results/stage1.json** tới **stage5.json**,
thêm **stage5_python.json** và **campaign.json**; thư mục này được bỏ qua trong Git.
Parser/runtime errors làm validation thất bại kể cả khi Godot trả exit code 0.

CI tương ứng: [.github/workflows/godot.yml](.github/workflows/godot.yml). Workflow ghim engine và checksum, chỉ cần quyền đọc nội dung repo.

## Thử Stage 2 backend

F5 mở menu campaign; nút Sandbox trong menu mở lại economy/navigation với F6/F7.
Để chạy ví dụ combat, aura và payroll độc lập:

    godot --headless --path . --script examples/stage2_backend_demo.gd

Thay `godot` bằng đường dẫn engine trên máy bro. Demo chạy 90 giây mô phỏng nhanh
nhất có thể, in damage Pike → Ritter, chỉ số aura và ba kỳ lương, rồi kết thúc bằng
**BACKEND DEMO: PASS**. Code tích hợp có trong [Stage 2 guide](docs/STAGE_2_COMBAT.md).

Luật Stage 2 mới thay aura damage trong GDD bằng **+15% tốc đánh/tốc chạy**, và dùng
kỳ lương **30s**, mặc định **1G/quân/kỳ**, chỉnh được. Theo prompt, trả vừa đủ để
Gold về 0 cũng gây mutiny. Payroll được bật riêng cho scenario; không tự thêm vào
skirmish. [Tài liệu](docs/STAGE_2_COMBAT.md) ghi rõ các khác biệt với GDD cũ.

## Thử Stage 3

Nhấn **F8** để tạo Black Forest với seed trong HUD (mặc định 1524). Map có 16 dân,
Town Center và tài nguyên thử nghiệm; chọn cây/mỏ để khai thác hoặc đi qua ba khe
rừng. Cây cạn mở đường đi mới. F6/F7 vẫn trở lại fixture cũ.

    godot --headless --path . --script examples/stage3_backend_demo.gd -- --seed=1524

Demo in thông tin map, đòn Pike từ **27 → 34 damage** khi đứng cao hơn, và
**MissionFailed sau 3 detection episodes** của Joß Fritz. File `.tres` trong
[data](data) chỉnh seed, kích thước, mật độ, mỏ và tham số mission.
[Stage 3 guide](docs/STAGE_3_MAPS_MISSIONS.md) có kiến trúc, API, cách gắn LOS
collider và các luật mới thay GDD cũ. Combat/stealth hiện là backend; F8 chưa phải
campaign có guard patrol hoặc quân chiến đấu điều khiển được.

## Thử Stage 4

Nhấn **F9** từ sandbox để mở phòng thử animation/audio: chọn phe → Preview Run →
Attack; thử Rate +15%, Idle, Preview Die và Space. Khi 12 unit giao tranh trong
viewport, nhạc crossfade sang Combat. Phụ đề cho biết câu được chọn theo phe.

    godot --headless --path . --script examples/stage4_backend_demo.gd

Asset hiện tại là **sprite hình học và âm tổng hợp kiểm thử**. Chưa có bản thu
lute/chorale hoặc giọng Frühneuhochdeutsch thật. Các câu tiếng Đức là draft casting
hiện đại hóa, chưa thẩm định lịch sử. Code có sẵn bank/stream slots để thay bằng
asset production. [Stage 4 guide](docs/STAGE_4_ASSETS_AUDIO.md) giải thích tạo
SpriteFrames, hit marker, crossfade, voice events, async loading và pooling.

Wind-up là tùy chọn theo unit; lab bật, các fixture Stage 2/3 cũ giữ marker 0 để
tương thích. Animation đọc simulation, không tự gây damage. Run trong lab là
preview tại chỗ; military navigation và art toàn bộ sandbox chưa nằm trong stage.

## Thử Stage 5

    python tools/balance.py validate
    python tools/balance.py simulate --godot /path/to/godot

Mặc định chạy **100 Peasant Flailmen vs 20 Heavy Gendarmes**, seed 1524, tốc độ
10× bằng fixed ticks thật. JSON/CSV xuất vào `balance-results/`, gồm survivors,
HP còn lại, thời gian game/thực, chi phí từng loại và snapshot/hash cấu hình.
Heavy Gendarme dùng base stats **Armoured Ritter** trong GDD: 125 HP, 12 attack,
giáp 2/2, 90F+100G; không lấy nhầm Elite hoặc nâng cấp đã cộng bonus.

Sửa bản sao của [unit database](data/balance/units.v1.json), rồi chạy session reload:

    python tools/balance.py watch --godot /path/to/godot --database /path/to/experiment.json

File hợp lệ được dùng cho trận kế tiếp trong cùng process; file lỗi giữ revision
cũ. Quân đang đánh giữ HP/cooldown cũ. `--unpaced --runs 5` chạy batch nhiều seed
nhanh nhất CPU; đây là chế độ khác với paced 10×. F5/F9 không tự watch file.

[Stage 5 guide](docs/STAGE_5_BALANCE.md) có cấu trúc JSON, Python/Godot API, reload
policy, cách đọc báo cáo và giới hạn. [Validation](docs/STAGE_5_VALIDATION.md)
ghi kết quả thật; arena kín dùng local steering, chưa thay military pathfinding
cho map rừng/cầu hoặc chứng minh win rate skirmish.

## Tổ chức source

| Đường dẫn | Trách nhiệm |
|---|---|
| [scripts/core](scripts/core) | Composition root, static grid, demo fixtures |
| [scripts/navigation](scripts/navigation) | A* scheduler và cooperative traffic |
| [scripts/economy](scripts/economy) | Resource types, finite nodes, global bank |
| [scripts/units](scripts/units) | Villager data và state machine |
| [scripts/construction](scripts/construction) | Building catalog, work/HP/completion |
| [scripts/combat](scripts/combat) | CombatWorld, damage, stat modifiers, spatial aura và mercenary payroll |
| [scripts/balance](scripts/balance) | Schema/syntax validation, versioned database, closed arena và fixed-step pacing |
| [data/balance](data/balance) | JSON base stats của 10 combat units và schema dùng chung |
| [tools/balance.py](tools/balance.py) / [tools/unit_db.py](tools/unit_db.py) | Python CLI, parser, JSON/CSV reports và watch |
| [docs/STAGE_5_BALANCE.md](docs/STAGE_5_BALANCE.md) | Designer workflow, base stats, simulation và runtime reload |
| [docs/STAGE_5_VALIDATION.md](docs/STAGE_5_VALIDATION.md) | Regression results, baseline và giới hạn diễn giải balance |
| [scripts/maps](scripts/maps) | Recipe, seeded generator, validation và playable factory |
| [scripts/missions](scripts/missions) | Mission state, exposure/counts và Area2D LOS adapter |
| [data](data) | Map/mission Resources chỉnh qua Inspector |
| [scripts/animation](scripts/animation) | Shared animation profiles, state controller và pool 200 views |
| [scripts/audio](scripts/audio) | Music director, synchronized crossfade, voice selector/router và player pool |
| [scripts/assets](scripts/assets) | Threaded asset scope và diagnostic asset factory |
| [scenes/stage4_lab.tscn](scenes/stage4_lab.tscn) | Phòng thử tích hợp F9 |
| [scripts/presentation](scripts/presentation) | Input, greybox renderer, minimap, HUD |
| [tests/run_tests.gd](tests/run_tests.gd) | Integration tests dùng chính model của game |
| [tests/combat_tests.gd](tests/combat_tests.gd) | Combat/aura/payroll regression và mass-battle benchmark |
| [examples/stage2_backend_demo.gd](examples/stage2_backend_demo.gd) | Ví dụ backend chạy được qua command line |
| [docs/STAGE_1_ARCHITECTURE.md](docs/STAGE_1_ARCHITECTURE.md) | Luồng dữ liệu, thuật toán, invariants và extension points |
| [docs/STAGE_1_VALIDATION.md](docs/STAGE_1_VALIDATION.md) | Phạm vi kiểm thử, kết quả và giới hạn |
| [docs/STAGE_2_COMBAT.md](docs/STAGE_2_COMBAT.md) | Luật Stage 2, API/events, timing, movement adapter và ví dụ |
| [docs/STAGE_2_VALIDATION.md](docs/STAGE_2_VALIDATION.md) | Kết quả và phạm vi kiểm thử backend |
| [tests/stage3_tests.gd](tests/stage3_tests.gd) | Map, runtime economy/navigation, height và physics LOS regressions |
| [examples/stage3_backend_demo.gd](examples/stage3_backend_demo.gd) | Seeded map, high-ground hit và ba detection episodes |
| [docs/STAGE_3_MAPS_MISSIONS.md](docs/STAGE_3_MAPS_MISSIONS.md) | Cấu hình, thuật toán, integration và phạm vi Stage 3 |
| [docs/STAGE_3_VALIDATION.md](docs/STAGE_3_VALIDATION.md) | Kết quả kiểm thử ba stage và giới hạn đo đạc |
| [tests/stage4_tests.gd](tests/stage4_tests.gd) | Wind-up/animation/audio/voice/pool và scene regressions |
| [examples/stage4_backend_demo.gd](examples/stage4_backend_demo.gd) | Demo tích hợp nhanh qua CLI |
| [docs/STAGE_4_ASSETS_AUDIO.md](docs/STAGE_4_ASSETS_AUDIO.md) | Asset contracts, API, artist/audio workflow |
| [docs/STAGE_4_VALIDATION.md](docs/STAGE_4_VALIDATION.md) | Kết quả kiểm thử và giới hạn headless |
| [docs/gdd](docs/gdd) | Bốn phase thiết kế làm nền cho các stage tiếp theo |
| [AGENTS.md](AGENTS.md) | Quy tắc thay đổi source cho người và AI agent |

## Giới hạn hiện tại

- Navigation được kiểm tra cho **tối đa 200 friendly foot units cùng kích thước**. Passing dùng bán kính 0,18 ô; siege/cavalry lớn cần clearance và quy tắc giao thông riêng trước khi thêm.
- Có gather bonus Food/Wood Bundschuh và carry bonus League A3 ở lớp model. Demo đang dùng Bundschuh A1; chưa có màn chọn phe/age-up.
- Stage 2 có backend combat; chưa gắn military roster/speed modifiers vào controller di chuyển dân hoặc scene F5. Military navigation, lựa chọn quân và giao diện combat là bước tích hợp tiếp theo. Combat API trả movement budget đã buff; không tự di chuyển xuyên vật cản.
- Có stealth trigger backend; chưa có campaign hoàn chỉnh, fog of war, tech tree, unit recruitment, save/load hoặc multiplayer. Housing được theo dõi ở Stage 1; combat spawn là API scenario riêng, chưa thu chi phí tuyển hoặc kiểm tra housing.
- Gather rates, building HP/footprints và công thức nhiều dân xây là tham số prototype được ghi trong architecture; chưa phải kết quả cân bằng cuối.
- Hiệu năng headless của simulation không phải FPS đồ họa. Kiểm tra GPU/rendering và playtest trên máy mục tiêu là bước tiếp theo trước khi gọi đây là bản production hoàn chỉnh.
