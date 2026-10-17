extends Control
## Screen-space tactical presentation. No damage or timers live in drawing code.

const PAPER := Color("e7dcc0")
const GOLD := Color("d4b46f")
const GREEN := Color("9dcc9c")
const RED := Color("d98070")
var missions: Array = CampaignBattle.catalog()
var battle: CampaignBattle
var selected: Array[int] = []
var paused := false
var speed := 1
var accumulator := 0.0
var dragging := false
var drag_start := Vector2.ZERO
var map_rect := Rect2()
var scale_tiles := 1.0
var font: Font = ThemeDB.fallback_font
var menu: PanelContainer
var mission_list: ItemList
var briefing: RichTextLabel
var title_label: Label
var stock_label: Label
var objectives_label: Label
var details_label: Label
var status_label: Label
var pause_button: Button
var speed_button: Button
var current_index := 1
var recruit_buttons: Dictionary = {}


func _ready() -> void:
	_build_ui()
	battle = CampaignBattle.new(missions[current_index])
	_show_menu()


func _panel_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color("18271f")
	style.border_color = Color("60705a")
	style.set_border_width_all(1)
	style.set_content_margin_all(18)
	return style


func _button(text: String, action: Callable, parent: Node) -> Button:
	var button := Button.new()
	button.text = text
	button.pressed.connect(action)
	button.focus_mode = Control.FOCUS_NONE
	button.custom_minimum_size.y = 34
	parent.add_child(button)
	return button


func _label(parent: Node, size: int = 16) -> Label:
	var label := Label.new()
	label.add_theme_color_override("font_color",PAPER)
	label.add_theme_font_size_override("font_size",size)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(label)
	return label


func _build_ui() -> void:
	var header := PanelContainer.new()
	header.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	header.offset_bottom = 78
	header.add_theme_stylebox_override("panel",_panel_style())
	add_child(header)
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation",18)
	header.add_child(top)
	title_label = _label(top,21)
	title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stock_label = _label(top,14)
	stock_label.custom_minimum_size.x = 240
	_button("Nhiệm vụ [Esc]",_show_menu,top)
	var side := PanelContainer.new()
	side.anchor_left = 1
	side.anchor_right = 1
	side.anchor_bottom = 1
	side.offset_left = -320
	side.offset_top = 78
	side.offset_bottom = -78
	side.add_theme_stylebox_override("panel",_panel_style())
	add_child(side)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	side.add_child(scroll)
	var stack := VBoxContainer.new()
	stack.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stack.add_theme_constant_override("separation",18)
	scroll.add_child(stack)
	_label(stack,14).text = "MỤC TIÊU CHIẾN THUẬT"
	objectives_label = _label(stack,16)
	details_label = _label(stack,14)
	_label(stack,14).text = "TUYỂN QUÂN TẠI TRẠI"
	for type: String in ["peasant_flailman","pikeman","radical_preacher","landsknecht_pikeman","heavy_gendarme","crossbowman"]:
		var raw := CombatUnitCatalog.default_database().definition(type)
		var label := "%s · %dF %dW %dG · %ds"%[type.replace("peasant_","").replace("radical_","").replace("landsknecht_","L.").replace("heavy_","").capitalize(),raw.cost.food,raw.cost.wood,raw.cost.gold,raw.train_seconds]
		recruit_buttons[type] = _button(label,func() -> void: battle.recruit(type),stack)
	status_label = _label(stack,14)
	var bottom := PanelContainer.new()
	bottom.anchor_top = 1
	bottom.anchor_bottom = 1
	bottom.anchor_right = 1
	bottom.offset_top = -78
	bottom.add_theme_stylebox_override("panel",_panel_style())
	add_child(bottom)
	var commands := HBoxContainer.new()
	commands.add_theme_constant_override("separation",8)
	bottom.add_child(commands)
	_button("Quân [Tab]",func() -> void: _select_tags(["soldier","reinforcement"]),commands)
	_button("Hero [Q]",func() -> void: _select_heroes(),commands)
	_button("Dân [V]",func() -> void: _select_tags(["civilian","courier"]),commands)
	_button("Xe / sứ giả [C]",func() -> void: _select_tags(["cart","messenger","envoy","prisoner"]),commands)
	pause_button = _button("Dừng [Space]",func() -> void: paused = not paused,commands)
	speed_button = _button("Tốc độ 1×",func() -> void: speed=3-speed,commands)
	_button("Chơi lại",_start,commands)
	menu = PanelContainer.new()
	menu.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	menu.add_theme_stylebox_override("panel",_panel_style())
	add_child(menu)
	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation",14)
	menu.add_child(layout)
	_label(layout,34).text = "BUNDSCHUH : REBELLION"
	_label(layout,16).text = "1524–1525     /     HAI CHIẾN DỊCH     /     13 DEMO CHƠI ĐƯỢC"
	var columns := HBoxContainer.new()
	columns.size_flags_vertical = Control.SIZE_EXPAND_FILL
	columns.add_theme_constant_override("separation",28)
	layout.add_child(columns)
	mission_list = ItemList.new()
	mission_list.custom_minimum_size.x = 390
	mission_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	mission_list.add_theme_constant_override("v_separation",14)
	mission_list.add_theme_font_size_override("font_size",17)
	for spec: Dictionary in missions:
		mission_list.add_item(spec.id+"  ·  "+spec.title.split(" · ")[0])
	mission_list.item_selected.connect(func(index: int) -> void: current_index=index; _update_briefing())
	columns.add_child(mission_list)
	briefing = RichTextLabel.new()
	briefing.bbcode_enabled = true
	briefing.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	briefing.add_theme_font_size_override("normal_font_size",18)
	columns.add_child(briefing)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation",18)
	layout.add_child(row)
	_button("BẮT ĐẦU NHIỆM VỤ",_start,row)
	_button("Sandbox kinh tế Stage 1–5",func() -> void: get_tree().change_scene_to_file("res://scenes/main.tscn"),row)
	_label(layout,14).text = "Click / kéo chọn · Shift thêm nhóm · Click phải di chuyển / tấn công · Giữ 3 quân tại điểm để chiếm · Offline"


func _update_briefing() -> void:
	var spec: Dictionary = missions[current_index]
	briefing.text = "[color=#d4b46f][font_size=28]"+spec.id+"  /  "+spec.title+"[/font_size][/color]\n\n"+spec.place+"\n\n"+spec.brief+"\n\n[color=#9dcc9c]BẢN DEMO THU NHỎ[/color]\n"+spec.limits+"\n\nKhông có lưu trận, multiplayer, art production hoặc toàn bộ tech tree. Muốn thử khai thác và xây nhà, mở Sandbox."


func _show_menu() -> void:
	menu.show()
	mission_list.select(current_index)
	_update_briefing()
	paused = true
	_refresh()


func _start() -> void:
	battle = CampaignBattle.new(missions[current_index])
	selected.clear()
	accumulator = 0
	paused = false
	dragging = false
	menu.hide()
	_select_heroes()
	_refresh()


func _process(delta: float) -> void:
	if battle == null:
		return
	if not paused and not menu.visible:
		accumulator = minf(accumulator+delta*speed,0.5)
		while accumulator>=CampaignBattle.DT:
			battle.step()
			accumulator-=CampaignBattle.DT
	_refresh()
	queue_redraw()


func _refresh() -> void:
	if battle == null:
		return
	title_label.text = battle.spec.id+"  /  "+battle.spec.title
	stock_label.text = "%02d:%02d   |   %dF  %dW  %dG"%[int(battle.sim.time)/60,int(battle.sim.time)%60,battle.sim.bank.amount(0),battle.sim.bank.amount(1),battle.sim.bank.amount(2)]
	var lines := PackedStringArray()
	for goal: Dictionary in battle.goals:
		lines.append(battle.goal_text(goal))
	objectives_label.text = "\n\n".join(lines)
	details_label.text = battle.spec.place+"\n\n"+battle.spec.limits
	status_label.text = "Đã chọn: %d · Hàng chờ: %d\n\n"%[selected.size(),battle.recruit_queue.size()]+battle.notice
	var roster: Array = ["landsknecht_pikeman","heavy_gendarme","crossbowman"] if battle.spec.side=="swabian_league" else ["pikeman","peasant_flailman","crossbowman","radical_preacher"]
	for type: String in recruit_buttons:
		recruit_buttons[type].visible = type in roster
		recruit_buttons[type].disabled = battle.spec.get("stealth",false) or battle.result!=""
	if not battle.recruit_queue.is_empty():
		status_label.text += "\nQuân kế tiếp: %ds"%ceili(battle.recruit_queue[0].seconds)
	if battle.wave_at>battle.sim.time:
		status_label.text += "\nPhản công: %ds"%ceili(battle.wave_at-battle.sim.time)
	if battle.detection != null:
		status_label.text += "\nPHÁT HIỆN %d/3 · %d%%"%[battle.detection.detections,battle.detection.meter]
	if battle.result != "":
		status_label.text = ("HOÀN THÀNH\n" if battle.result=="victory" else "THẤT BẠI\n")+battle.reason+"\n\nChọn Chơi lại hoặc Nhiệm vụ."
	pause_button.text = "Tiếp [Space]" if paused else "Dừng [Space]"
	speed_button.text = "Tốc độ %d×"%speed


func _select_tags(tags: Array) -> void:
	selected.clear()
	for id: int in battle.bodies:
		if battle.selectable(id) and battle.bodies[id].tag in tags:
			selected.append(id)


func _select_heroes() -> void:
	selected.clear()
	for id: int in battle.bodies:
		if battle.selectable(id) and battle.bodies[id].actor!="":
			selected.append(id)


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode==KEY_ESCAPE:
		_show_menu()
	if menu.visible:
		return
	if event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT and not event.pressed and dragging:
		dragging = false
		var rect := Rect2(drag_start,event.position-drag_start).abs()
		if not event.shift_pressed:
			selected.clear()
		var nearest := -1
		var distance := 18.0
		for id: int in battle.bodies:
			if not battle.selectable(id):
				continue
			var point := _screen(battle.bodies[id].unit.position)
			if rect.size.length()>8 and rect.has_point(point):
				if id not in selected:
					selected.append(id)
			elif rect.size.length()<=8 and point.distance_to(event.position)<distance:
				distance = point.distance_to(event.position)
				nearest = id
		if nearest>=0:
			if nearest in selected:
				selected.erase(nearest)
			else:
				selected.append(nearest)
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_SPACE: paused = not paused; get_viewport().set_input_as_handled()
			KEY_TAB: _select_tags(["soldier","reinforcement"]); get_viewport().set_input_as_handled()
			KEY_Q: _select_heroes()
			KEY_V: _select_tags(["civilian","courier"])
			KEY_C: _select_tags(["cart","messenger","envoy","prisoner"])
			KEY_X:
				battle.stop(selected)
	if event is InputEventMouseButton and event.pressed and map_rect.has_point(event.position):
		if event.button_index==MOUSE_BUTTON_LEFT:
			drag_start = event.position
			dragging = true
		elif event.button_index==MOUSE_BUTTON_RIGHT:
			var pos: Vector2 = (event.position-map_rect.position)/scale_tiles
			var target := -1
			for u: CombatUnit in battle.combat.units.values():
				if u.owner_id==1 and u.alive() and u.on_field and u.position.distance_to(pos)<1:
					target = u.id
			for p: Dictionary in battle.points.values():
				if p.kind=="neutral" and p.pos.distance_to(pos)<2:
					target = -2
			if target==-2:
				battle.notice = "Khu đình chiến: click phải đưa sứ giả đàm phán. A + click phải là lệnh tấn công chủ động."
			battle.command(selected,pos,target if target>=0 else -1,Input.is_physical_key_pressed(KEY_A))


func _screen(point: Vector2) -> Vector2:
	return map_rect.position+point*scale_tiles


func _draw() -> void:
	if battle == null:
		return
	var available := Rect2(12,90,maxf(100,size.x-344),maxf(100,size.y-180))
	scale_tiles = minf(available.size.x/42,available.size.y/30)
	map_rect = Rect2(available.get_center()-Vector2(42,30)*scale_tiles/2,Vector2(42,30)*scale_tiles)
	draw_rect(Rect2(Vector2.ZERO,size),Color("101c17"))
	draw_rect(map_rect,Color("40513b") if battle.spec.terrain!="town" else Color("575443"))
	if battle.spec.terrain in ["hill","valley"]:
		draw_colored_polygon(PackedVector2Array([_screen(Vector2(16,1)),_screen(Vector2(40,1)),_screen(Vector2(40,11)),_screen(Vector2(19,11)),_screen(Vector2(16,8))]),Color("68704a"))
		draw_line(_screen(Vector2(19,11)),_screen(Vector2(40,11)),Color("b2a776"),2)
		draw_string(font,_screen(Vector2(23,3)),"CAO ĐIỂM · +25%",HORIZONTAL_ALIGNMENT_LEFT,-1,12,GOLD)
	if battle.spec.terrain=="river":
		draw_rect(Rect2(_screen(Vector2(20,0)),Vector2(3,30)*scale_tiles),Color("385d66"))
	for y: float in [7.5,15.5,23.5]:
		draw_line(_screen(Vector2(1,y)),_screen(Vector2(41,y)),Color("857b58"),scale_tiles*1.4)
		draw_line(_screen(Vector2(1,y+0.12)),_screen(Vector2(41,y+0.12)),Color("afa077"),1)
	draw_line(_screen(Vector2(6,5)),_screen(Vector2(6,25)),Color("857b58"),scale_tiles)
	draw_line(_screen(Vector2(36,5)),_screen(Vector2(36,25)),Color("857b58"),scale_tiles)
	for cell: Vector2i in battle.sim.grid.blockers:
		if cell.x==0 or cell.y==0 or cell.x==41 or cell.y==29:
			continue
		if battle.spec.terrain=="river" and cell.x>=20 and cell.x<=22:
			continue
		var p := _screen(Vector2(cell)+Vector2(0.5,0.5))
		draw_circle(p+Vector2(2,3),scale_tiles*0.65,Color(0.04,0.10,0.07,0.3))
		draw_line(p,p-Vector2(0,scale_tiles*0.65),Color("66503a"),3)
		draw_circle(p-Vector2(0,scale_tiles*0.45),scale_tiles*0.65,Color("254633"))
		draw_circle(p-Vector2(3,scale_tiles*0.65),scale_tiles*0.36,Color("4c6d42"))
	for i in range(7):
		var p := _screen(Vector2(3+i%3*2.3,5+i/3*8))
		var w := scale_tiles*1.8
		draw_rect(Rect2(p,Vector2(w,w*0.7)),Color("b1a17b"))
		draw_colored_polygon(PackedVector2Array([p+Vector2(-3,1),p+Vector2(w/2,-w*0.6),p+Vector2(w+3,1)]),Color("714d3a"))
	for point: Dictionary in battle.points.values():
		var p := _screen(point.pos)
		var color := GREEN if point.owned or point.done or point.kind=="exit" else (RED if point.kind in ["hostile","prisoner"] else GOLD)
		draw_arc(p,scale_tiles*2.4,0,TAU,48,Color(color,0.35),1)
		if point.progress>0:
			draw_arc(p,scale_tiles*2.4,-PI/2,-PI/2+TAU*minf(1,point.progress/6),40,color,2)
		draw_line(p,p-Vector2(0,scale_tiles*1.4),Color("dbc699"),2)
		draw_colored_polygon(PackedVector2Array([p-Vector2(0,scale_tiles*1.4),p+Vector2(scale_tiles*0.9,-scale_tiles*1.1),p-Vector2(0,scale_tiles*0.8)]),color)
		draw_string(font,p+Vector2(-36,scale_tiles*2.8),point.name,HORIZONTAL_ALIGNMENT_LEFT,-1,12,PAPER)
	if battle.detection != null:
		for i in range(3):
			var p := _screen(battle.guard_position(i))
			draw_circle(p,scale_tiles*2.5,Color(0.85,0.33,0.23,0.13))
			draw_arc(p,scale_tiles*2.5,0,TAU,40,RED,1)
			draw_circle(p,5,RED)
	for id: int in battle.bodies:
		var u: CombatUnit = battle.bodies[id].unit
		if not u.alive() or not u.on_field:
			continue
		var body: Dictionary = battle.bodies[id]
		var p := _screen(u.position)
		var color := GREEN if u.owner_id==0 else (GOLD if u.owner_id==2 else RED)
		var r := maxf(3,scale_tiles*0.20)
		if id in selected:
			draw_arc(p+Vector2(0,3),r+4,0,TAU,20,GREEN,1.5)
		draw_circle(p+Vector2(2,4),r+2,Color(0,0,0,0.25))
		if body.tag=="structure":
			draw_rect(Rect2(p-Vector2(10,9),Vector2(20,18)),Color("8b7a58"))
			draw_rect(Rect2(p-Vector2(10,9),Vector2(20,18)),color,false,2)
		elif body.tag=="cart":
			draw_rect(Rect2(p-Vector2(7,5),Vector2(14,10)),Color("a0804c"))
			draw_circle(p+Vector2(-5,5),3,Color("1c2921"))
			draw_circle(p+Vector2(5,5),3,Color("1c2921"))
		else:
			if u.definition_id=="heavy_gendarme":
				draw_line(p+Vector2(-6,4),p+Vector2(5,4),Color("9c8c6b"),7)
			draw_line(p,p+Vector2(0,-6),color,r*1.7)
			draw_circle(p-Vector2(0,7),r*0.7,Color("dec6a0"))
			if u.attack>0:
				draw_line(p+Vector2(4,0),p+Vector2(7,-10),Color("c9cbbb"),1.5)
		if body.actor!="":
			draw_string(font,p+Vector2(-18,-16),str(body.actor).capitalize(),HORIZONTAL_ALIGNMENT_LEFT,-1,11,GOLD)
		elif body.tag not in ["soldier","structure"]:
			draw_string(font,p+Vector2(-12,-14),{"civilian":"DÂN","cart":"XE","courier":"TIN","messenger":"SỨ","prisoner":"TÙ","reinforcement":"VIỆN"}.get(body.tag,""),HORIZONTAL_ALIGNMENT_LEFT,-1,9,PAPER)
		draw_line(p+Vector2(-7,9),p+Vector2(7,9),Color("18291f"),2)
		draw_line(p+Vector2(-7,9),p+Vector2(-7+14.0*u.hp/u.max_hp,9),color,2)
	if dragging:
		draw_rect(Rect2(drag_start,get_local_mouse_position()-drag_start).abs(),Color(0.6,0.85,0.65,0.12))
		draw_rect(Rect2(drag_start,get_local_mouse_position()-drag_start).abs(),GREEN,false,1)
	if battle.result!="":
		draw_rect(map_rect,Color(0.04,0.08,0.05,0.78))
		draw_string(font,map_rect.get_center()-Vector2(160,0),"HOÀN THÀNH" if battle.result=="victory" else "THẤT BẠI",HORIZONTAL_ALIGNMENT_LEFT,-1,36,GOLD)
