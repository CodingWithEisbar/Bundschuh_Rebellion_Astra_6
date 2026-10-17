extends Node2D
## Thin scene/controller: input -> model commands; signals/state -> HUD.
## No external art/audio dependencies are required to open this Stage 1 project.

var world: RtsSimulation
var view: RtsWorldView
var camera: Camera2D
var minimap: RtsMinimap
var selected: Array[int] = []
var stock_labels: Dictionary = {}
var stats_label: Label
var selection_label: Label
var info_label: Label
var message_label: Label
var pause_button: Button
var speed_button: Button
var seed_input: LineEdit
var accumulator: float = 0.0
var hud_elapsed: float = 0.0
var paused: bool = false
var speed: int = 1
var drag_start := Vector2.ZERO
var dragging: bool = false
var placing: String = ""
var inspected_building: int = -1
var message_until: float = 0.0


func _ready() -> void:
	view = RtsWorldView.new()
	add_child(view)
	camera = Camera2D.new()
	camera.zoom = Vector2.ONE * 0.70
	add_child(camera)
	_build_hud()
	_reset(false)


func _reset(stress: bool) -> void:
	_mount_world(DemoFactory.create(stress))
	if stress:
		_select_all()
		world.command_move(selected, Vector2i(53, 19))
	_show_message("200 villagers ordered through the one-cell forest pass." if stress else
		"Select villagers, then right-click a resource. H/J/K/L place buildings.")
	_refresh_hud()


func _reset_forest() -> void:
	var seed_text := seed_input.text.strip_edges()
	if not seed_text.is_valid_int():
		_show_message("Seed must be an integer. Current map kept.")
		return
	var config := load("res://data/maps/black_forest_default.tres").duplicate(true) as BlackForestConfig
	config.seed_value = seed_text.to_int()
	var map := BlackForestGenerator.generate(config)
	if not map.valid():
		_show_message("Map generation failed: " + "; ".join(map.errors))
		return
	_mount_world(BlackForestFactory.create(map))
	seed_input.release_focus()
	_show_message("Black Forest · seed %d · 3 passages · trees can be harvested." % config.seed_value)
	_refresh_hud()


func _mount_world(next_world: RtsSimulation) -> void:
	world = next_world
	view.model = world
	minimap.model = world
	selected.clear()
	placing = ""
	view.placement_key = ""
	dragging = false
	view.selecting = false
	inspected_building = -1
	accumulator = 0.0
	paused = false
	pause_button.text = "Pause [Space]"
	camera.position = Vector2(world.grid.size) * RtsWorldView.CELL / 2 + Vector2(0, 105)
	world.bank.changed.connect(_update_stock)
	world.notice.connect(_show_message)
	_update_stock(world.bank.snapshot())


func _physics_process(delta: float) -> void:
	if world == null or paused:
		return
	# Bounded catch-up prevents a stalled renderer causing a spiral of death.
	# Excess wall time is dropped; this is a local prototype, not lockstep.
	accumulator = minf(accumulator + delta * speed, 0.50)
	var steps := 0
	while accumulator >= RtsSimulation.FIXED_DT and steps < 10:
		world.step()
		accumulator -= RtsSimulation.FIXED_DT
		steps += 1


func _process(delta: float) -> void:
	if world == null:
		return
	var pan := Vector2.ZERO
	var editing_seed := seed_input.has_focus()
	if not editing_seed and Input.is_physical_key_pressed(KEY_W):
		pan.y -= 1
	if not editing_seed and Input.is_physical_key_pressed(KEY_S):
		pan.y += 1
	if not editing_seed and Input.is_physical_key_pressed(KEY_A) and not Input.is_key_pressed(KEY_CTRL):
		pan.x -= 1
	if not editing_seed and Input.is_physical_key_pressed(KEY_D):
		pan.x += 1
	camera.position += pan.normalized() * 600.0 * delta / camera.zoom.x
	view.selected = selected
	view.placement_key = placing
	if placing != "":
		view.placement_cell = view.grid_cell(get_global_mouse_position())
		var validation := world.validate_placement(placing, view.placement_cell, selected)
		view.placement_ok = validation["ok"]
		message_label.text = validation["reason"] + "  |  Esc / right-click: cancel"
	view.queue_redraw()
	minimap.queue_redraw()
	hud_elapsed += delta
	if hud_elapsed >= 0.15:
		hud_elapsed = 0.0
		_refresh_hud()


func _input(event: InputEvent) -> void:
	# Capture release even when a world drag ends over the HUD. Otherwise a
	# panel consumes mouse-up and leaves selection stuck in dragging mode.
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed and dragging:
		_finish_selection(event.shift_pressed)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and not event.echo:
		# Text entry owns Ctrl+A, Space and letter keys while the seed is focused.
		if seed_input.has_focus() and event.keycode not in [KEY_ESCAPE, KEY_F8, KEY_F9]:
			return
		# RTS shortcuts take precedence over a focused button's ui_accept.
		# Space must pause, not accidentally activate the last clicked button.
		if event.keycode in [KEY_ESCAPE, KEY_SPACE, KEY_X, KEY_TAB, KEY_F6, KEY_F7, KEY_F8, KEY_F9, KEY_H, KEY_J, KEY_K, KEY_L] or (event.keycode == KEY_A and event.ctrl_pressed):
			_unhandled_input(event)
			get_viewport().set_input_as_handled()


func _unhandled_input(event: InputEvent) -> void:
	if world == null:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if seed_input.has_focus() and event.keycode not in [KEY_ESCAPE, KEY_F8, KEY_F9]:
			return
		if event.keycode == KEY_ESCAPE:
			seed_input.release_focus()
			placing = ""
			dragging = false
			view.selecting = false
		elif event.keycode == KEY_SPACE:
			_toggle_pause()
		elif event.keycode == KEY_A and event.ctrl_pressed:
			_select_all()
		elif event.keycode == KEY_X:
			world.command_stop(selected)
		elif event.keycode == KEY_TAB:
			view.show_paths = not view.show_paths
		elif event.keycode == KEY_F6:
			_reset(false)
		elif event.keycode == KEY_F7:
			_reset(true)
		elif event.keycode == KEY_F8:
			_reset_forest()
		elif event.keycode == KEY_F9:
			get_tree().call_deferred("change_scene_to_file", "res://scenes/stage4_lab.tscn")
		elif event.keycode in [KEY_H, KEY_J, KEY_K, KEY_L]:
			var bindings := {KEY_H: "house", KEY_J: "mill", KEY_K: "lumber_camp", KEY_L: "mining_camp"}
			_begin_placement(bindings[event.keycode])
	if event is InputEventMouseMotion:
		if event.button_mask & MOUSE_BUTTON_MASK_MIDDLE:
			camera.position -= event.relative / camera.zoom
		if dragging:
			view.selection_rect = Rect2(drag_start, get_global_mouse_position() - drag_start)
	if event is InputEventMouseButton:
		if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
			var multiplier := 1.12 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.12
			camera.zoom = Vector2.ONE * clampf(camera.zoom.x * multiplier, 0.4, 2.0)
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				if placing != "":
					var building := world.place_building(placing, view.grid_cell(get_global_mouse_position()), selected)
					if building != null:
						inspected_building = building.id
						placing = ""
				else:
					drag_start = get_global_mouse_position()
					dragging = true
					view.selecting = true
					view.selection_rect = Rect2(drag_start, Vector2.ZERO)
			elif dragging:
				_finish_selection(event.shift_pressed)
		elif event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
			if placing != "":
				placing = ""
			else:
				_issue_context_order(view.grid_cell(get_global_mouse_position()))


func _select_all() -> void:
	selected.assign(world.agents.keys())
	_refresh_hud()


func _finish_selection(additive: bool) -> void:
	var end := get_global_mouse_position()
	dragging = false
	view.selecting = false
	inspected_building = -1
	if not additive:
		selected.clear()
	var rect := Rect2(drag_start, end - drag_start).abs()
	if rect.size.length() < 8.0 / camera.zoom.x:
		var nearest: VillagerAgent = null
		var distance := 14.0 / camera.zoom.x
		for agent: VillagerAgent in world.agents.values():
			var d := (agent.display_position(world.motion_alpha()) * RtsWorldView.CELL).distance_to(end)
			if d < distance:
				nearest = agent
				distance = d
		if nearest != null:
			if additive and nearest.id in selected:
				selected.erase(nearest.id)
			elif nearest.id not in selected:
				selected.append(nearest.id)
		else:
			var cell := view.grid_cell(end)
			for building: RtsBuilding in world.buildings.values():
				if building.footprint.has_point(cell):
					inspected_building = building.id
	else:
		for agent: VillagerAgent in world.agents.values():
			if rect.has_point(agent.display_position(world.motion_alpha()) * RtsWorldView.CELL) and agent.id not in selected:
				selected.append(agent.id)
	_refresh_hud()


func _issue_context_order(cell: Vector2i) -> void:
	if selected.is_empty():
		_show_message("Select villagers first (drag or Ctrl+A).")
		return
	for resource: GatherableResource in world.resources.values():
		if resource.remaining > 0 and resource.footprint.has_point(cell):
			world.command_gather(selected, resource.id)
			return
	for building: RtsBuilding in world.buildings.values():
		if building.footprint.has_point(cell):
			if not building.finished:
				world.command_build(selected, building.id)
			elif not building.accepted_resources.is_empty():
				world.command_deliver(selected)
			inspected_building = building.id
			return
	if world.grid.contains(cell):
		world.command_move(selected, cell)


func _begin_placement(key: String) -> void:
	placing = key
	dragging = false
	view.selecting = false


func _toggle_pause() -> void:
	paused = not paused
	pause_button.text = "Resume [Space]" if paused else "Pause [Space]"


func _toggle_speed() -> void:
	speed = 4 if speed == 1 else 1
	speed_button.text = "Speed: %dx" % speed


func _show_message(text: String) -> void:
	message_label.text = text
	message_until = Time.get_ticks_msec() / 1000.0 + 6.0


func _update_stock(snapshot: Dictionary) -> void:
	for kind: int in stock_labels:
		stock_labels[kind].text = "%s  %d" % [ResourceKind.NAMES[kind], snapshot[kind]]


func _refresh_hud() -> void:
	if world == null:
		return
	stats_label.text = "%d / %d villagers  |  Cap 200  |  %02d:%02d" % [
		world.agents.size(), world.housing, int(world.time) / 60, int(world.time) % 60]
	selection_label.text = "%d VILLAGERS SELECTED" % selected.size()
	var text := "Right-click: move / gather / construct\nH House · J Mill · K Lumber · L Mining\nWASD / middle drag: camera · wheel: zoom"
	if selected.size() == 1:
		var agent: VillagerAgent = world.agents[selected[0]]
		text = "Villager #%d — %s\nCargo: %d / %d %s\nNavigation: %s" % [
			agent.id, agent.status, agent.cargo, agent.capacity,
			ResourceKind.NAMES[agent.cargo_kind] if agent.cargo_kind >= 0 else "",
			agent.nav_status]
	var building: RtsBuilding = world.buildings.get(inspected_building)
	if building != null:
		text += "\n%s: %.0f / %.0f HP — %.0f%%" % [BuildingCatalog.DEFINITIONS[building.key]["name"],
			building.hp, building.max_hp, building.progress() * 100]
	info_label.text = text
	if placing == "" and Time.get_ticks_msec() / 1000.0 > message_until:
		message_label.text = "Paths queued: %d  |  A* queries/tick: %d / %d  |  Passing pairs: %d  |  Tab: routes" % [
			world.paths.pending_count(), world.paths.queries_last_tick,
			world.paths.max_queries_per_tick, world.traffic.swaps_total]


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)

	var top := _panel()
	root.add_child(top)
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	top.offset_bottom = 62
	var top_row := HBoxContainer.new()
	top_row.add_theme_constant_override("separation", 22)
	top.add_child(top_row)
	var title := _label("BUNDSCHUH  /  STAGE 4", 18, Color("#dfc38c"))
	top_row.add_child(title)
	for kind in ResourceKind.Type.values():
		var label := _label("", 17, ResourceKind.COLORS[kind])
		label.custom_minimum_size.x = 115
		top_row.add_child(label)
		stock_labels[kind] = label
	stats_label = _label("", 15)
	stats_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stats_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	top_row.add_child(stats_label)

	var bottom := _panel()
	root.add_child(bottom)
	bottom.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.offset_top = -222
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 9)
	bottom.add_child(column)
	message_label = _label("", 15, Color("#adcdb9"))
	column.add_child(message_label)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 22)
	column.add_child(row)
	minimap = RtsMinimap.new()
	row.add_child(minimap)
	minimap.navigated.connect(func(point: Vector2) -> void: camera.position = point)
	var info := VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(info)
	selection_label = _label("", 16, Color("#dfc38c"))
	info.add_child(selection_label)
	info_label = _label("", 15)
	info.add_child(info_label)
	var actions := VBoxContainer.new()
	actions.custom_minimum_size.x = 435
	row.add_child(actions)
	var construction_row := HBoxContainer.new()
	actions.add_child(construction_row)
	for item in [["House [H]", "house"], ["Mill [J]", "mill"], ["Wood [K]", "lumber_camp"], ["Mine [L]", "mining_camp"]]:
		var key: String = item[1]
		var button := _button(item[0], func() -> void: _begin_placement(key))
		button.tooltip_text = "%s — %d Wood; select builders, then click a valid tile." % [
			BuildingCatalog.DEFINITIONS[key]["name"], BuildingCatalog.DEFINITIONS[key]["cost"][1]]
		construction_row.add_child(button)
	var commands := HBoxContainer.new()
	actions.add_child(commands)
	commands.add_child(_button("Select all", _select_all))
	commands.add_child(_button("Stop [X]", func() -> void: world.command_stop(selected)))
	pause_button = _button("Pause [Space]", _toggle_pause)
	commands.add_child(pause_button)
	speed_button = _button("Speed: 1x", _toggle_speed)
	commands.add_child(speed_button)
	var scenarios := HBoxContainer.new()
	actions.add_child(scenarios)
	scenarios.add_child(_button("16 [F6]", func() -> void: _reset(false)))
	scenarios.add_child(_button("200 [F7]", func() -> void: _reset(true)))
	scenarios.add_child(_button("Forest [F8]", _reset_forest))
	seed_input = LineEdit.new()
	seed_input.text = "1524"
	seed_input.placeholder_text = "Seed"
	seed_input.max_length = 18
	seed_input.custom_minimum_size.x = 100
	seed_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	seed_input.tooltip_text = "Black Forest seed. Enter or F8 regenerates the sandbox."
	seed_input.text_submitted.connect(func(_text: String) -> void: _reset_forest())
	scenarios.add_child(seed_input)
	actions.add_child(_button("Campaign / Nhiệm vụ", func() -> void: get_tree().change_scene_to_file("res://scenes/campaign.tscn")))


func _panel() -> PanelContainer:
	var panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color("#1e2529")
	style.border_color = Color("#756748")
	style.set_border_width_all(1)
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	panel.add_theme_stylebox_override("panel", style)
	return panel


func _label(text: String, font_size: int = 16, color: Color = Color("#f3ecd8")) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	return label


func _button(text: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.add_theme_font_size_override("font_size", 14)
	button.custom_minimum_size.y = 34
	button.pressed.connect(callback)
	return button
