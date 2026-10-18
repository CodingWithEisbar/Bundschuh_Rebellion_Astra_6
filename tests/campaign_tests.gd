extends SceneTree

var passed := 0
var errors: Array[String] = []
var specs: Array


func _initialize() -> void:
	call_deferred("_run")


func check(ok: bool, text: String) -> void:
	if not ok:
		errors.append(text)
		push_error(text)


func mission(id: String) -> CampaignBattle:
	return CampaignBattle.new(specs.filter(func(s: Dictionary) -> bool: return s.id==id)[0])


func ticks(b: CampaignBattle, count: int) -> void:
	for i in range(count):
		b.step()


func _run() -> void:
	specs = CampaignBattle.catalog()
	check(specs.size()==13,"13 authored mission demos")
	for spec: Dictionary in specs:
		var b := CampaignBattle.new(spec)
		ticks(b,20)
		check(b.result=="" and is_equal_approx(b.sim.time,1.0),spec.id+" creates and ticks real simulation")
		check(b.goals.size()==spec.goals.size(),spec.id+" has all authored objectives")
		for p: Dictionary in b.points.values():
			check(b.sim.grid.walkable(Vector2i(p.pos.floor())),spec.id+" reachable objective cell "+p.id)
		passed+=1
	for spec: Dictionary in specs:
		var solved := CampaignBattle.new(spec)
		for unit: CombatUnit in solved.combat.units.values():
			if unit.owner_id==1: unit.hp=unit.damage_floor_hp
			if unit.owner_id==2 and solved.bodies[unit.id].tag=="civilian": solved.combat.transfer_unit(unit.id,0)
		var army: Array[CombatUnit] = []
		for unit: CombatUnit in solved.combat.units.values():
			if unit.owner_id==0 and unit.can_attack(): army.append(unit)
		var slot := 0
		for p: Dictionary in solved.points.values():
			if p.kind in ["capture","prisoner"]:
				for i in range(3):
					if not army.is_empty():
						solved.combat.set_position(army[slot%army.size()].id,p.pos+Vector2(i*0.3,0.4))
						slot+=1
		for n in range(530):
			solved._update_points()
			solved._update_goals()
		if spec.get("reinforcements",false):
			for id: String in ["r1","r2"]:
				solved.combat.set_position(solved._actor("muentzer").id,solved.points[id].pos)
				solved._update_points()
				solved._update_goals()
		for goal: Dictionary in solved.goals:
			if goal.kind=="visit":
				for id: String in goal.ids:
					var p: Dictionary = solved.points[id]
					solved.combat.set_position(solved._actor(goal.actor).id,p.pos)
					for i in range(int(goal.escort)):
						solved.combat.set_position(army[i].id,p.pos+Vector2((i+1)*0.3,0))
					for n in range(ceili(float(goal.seconds)/0.05)+2): solved._update_goals()
			if goal.kind=="supply":
				solved.combat.set_position(solved._actor(goal.actor).id,solved.points[goal.point].pos)
				solved._update_goals()
			if goal.kind=="destroy":
				for id: String in goal.ids: solved.bodies[int(solved.points[id].body)].unit.hp=0
				solved._update_goals()
			if goal.kind=="survive":
				solved.sim.time=float(goal.seconds)+0.1
				solved._update_goals()
		for goal: Dictionary in solved.goals:
			if goal.kind=="escape":
				var destination := Vector2.ZERO
				for p: Dictionary in solved.points.values():
					if p.id==goal.to or (goal.to=="any_exit" and p.kind=="exit"): destination=p.pos
				for id: int in solved.bodies.keys():
					if solved.selectable(id) and solved.bodies[id].tag in goal.tags: solved.combat.set_position(id,destination)
				solved._update_goals()
		check(solved.goals.all(func(g: Dictionary) -> bool: return g.done),spec.id+" objective fixture reaches every authored goal")
		solved.step()
		check(solved.result=="victory",spec.id+" terminal victory: "+solved.reason)
		passed+=1
	var moving := mission("P0")
	var hero := moving._actor("joss_fritz")
	var origin := hero.position
	moving.command([hero.id],Vector2(9,15))
	ticks(moving,160)
	check(hero.position.distance_to(origin)>2,"actual center moves through navigation adapter")
	check(hero.position.distance_to(Vector2(9,15))<0.5,"commanded hero reaches requested point")
	var advance := mission("B1")
	var soldier: CombatUnit
	for unit: CombatUnit in advance.combat.units.values():
		if soldier==null and unit.owner_id==0 and unit.can_attack():
			soldier=unit
		else:
			advance.combat.set_on_field(unit.id,false)
	advance.combat.set_position(soldier.id,Vector2(5,15))
	var blocker := advance._spawn("peasant_flailman",1,Vector2(8,15),"soldier")
	advance.command([soldier.id],Vector2(14,15))
	ticks(advance,80)
	check(advance.bodies[soldier.id].goal==Vector2(14,15),"combat pursuit preserves issued movement destination")
	blocker.hp=0
	ticks(advance,240)
	check(soldier.position.distance_to(Vector2(14,15))<0.5,"soldier resumes original route after opponent dies")
	advance.stop([soldier.id])
	var stopped := soldier.position
	advance._spawn("peasant_flailman",1,Vector2(18,15),"soldier")
	ticks(advance,30)
	check(soldier.position.distance_to(stopped)<0.001,"Stop holds position without chasing")
	passed+=1
	var p0 := mission("P0")
	for id: String in ["meet1","meet2","meet3"]:
		p0.combat.set_position(p0._actor("joss_fritz").id,p0.points[id].pos)
		for i in range(41): p0._update_goals()
	p0.combat.set_position(p0._actor("joss_fritz").id,p0.points.exit.pos)
	ticks(p0,1)
	check(p0.result=="victory","P0 real objective flow reaches victory")
	passed+=1
	var detection := mission("P0")
	for episode in range(3):
		for i in range(41):
			detection.combat.set_position(detection._actor("joss_fritz").id,detection.guard_position(0))
			detection.step()
		if episode<2:
			detection.combat.set_position(detection._actor("joss_fritz").id,Vector2(5,15))
			ticks(detection,41)
	check(detection.result=="defeat" and detection.detection.detections==3,"third fully rearmed detection fails")
	passed+=1
	var a5 := mission("A5")
	var carts: Array = a5.bodies.values().filter(func(b: Dictionary) -> bool: return b.tag=="cart")
	carts[0].unit.hp=0
	a5._check_failure()
	check(a5.result=="","one cart lost still permits A5")
	carts[1].unit.hp=0
	a5._check_failure()
	check(a5.result=="defeat","second cart lost fails immediately")
	passed+=1
	var supply := mission("A3")
	supply.combat.set_position(supply._actor("muentzer").id,supply.points.depot.pos)
	supply._update_goals()
	supply._update_goals()
	check(supply.sim.bank.amount(0)==300 and supply.goals[1].done,"600 Food transaction charges exactly once")
	passed+=1
	var prisoner := mission("B4")
	var proxy: CombatUnit = prisoner.bodies[int(prisoner.points.cmd1.body)].unit
	proxy.receive_damage(10000)
	check(proxy.hp==45 and proxy.alive(),"lethal batch respects nonlethal surrender floor")
	for u: CombatUnit in prisoner.combat.units.values():
		if u.owner_id==0 and u.can_attack():
			prisoner.combat.set_position(u.id,prisoner.points.cmd1.pos+Vector2(1,0))
	for i in range(121): prisoner._update_points()
	check(prisoner.points.cmd1.released,"surrender and nearby escort release prisoner once")
	var captives: Array = prisoner.bodies.values().filter(func(b: Dictionary) -> bool: return b.tag=="prisoner")
	check(captives.size()==1,"one unique captive")
	if captives.size()==1: captives[0].unit.hp=0
	prisoner._check_failure()
	check(prisoner.result=="defeat","mandatory prisoner loss is terminal")
	passed+=1
	var b2 := mission("B2")
	b2.command([b2._actor("waldburg").id],b2.points.talk.pos)
	check(b2.result=="","normal negotiation order preserves truce")
	b2.command([b2._actor("waldburg").id],b2.points.talk.pos,-1,true)
	check(b2.result=="defeat","deliberate attack breaks truce")
	passed+=1
	var a6 := mission("A6")
	for i in range(17):
		var civilians: Array = a6.bodies.values().filter(func(b: Dictionary) -> bool: return b.tag=="civilian" and b.unit.alive())
		civilians[0].unit.hp=0
	a6._check_failure()
	check(a6.result=="defeat","new villagers cannot replace A6 mission identities")
	passed+=1
	var banner := mission("A6")
	banner.sim.time=195
	banner._update_goals()
	banner.bodies[int(banner.points.banner.body)].unit.hp=0
	banner._check_failure()
	check(banner.goals[0].done and banner.result=="","completed Banner survival remains latched")
	passed+=1
	var recruitment := mission("B1")
	var gold := recruitment.sim.bank.amount(2)
	check(recruitment.recruit("heavy_gendarme"),"own faction can queue soldier")
	check(recruitment.sim.bank.amount(2)==gold-100,"Gendarme base cost from shared JSON")
	check(not recruitment.recruit("peasant_flailman"),"other faction recruitment is rejected")
	check(recruitment.recruit_queue.size()==1,"recruitment waits actual train time")
	passed+=1
	var routes := mission("A4")
	check(routes._possible_route_pair(false),"unreleased third route remains feasible")
	for id: String in ["r1","r2"]:
		routes.points[id].released=true
	check(not routes._possible_route_pair(false),"two unavailable routes leave fewer than two feasible")
	passed+=1
	# Verify the actual new scene and every mission can start at common desktop sizes.
	var packed: PackedScene = load("res://scenes/campaign.tscn")
	var scene = packed.instantiate()
	root.add_child(scene)
	scene.set_process(false)
	for resolution in [Vector2i(1024,768),Vector2i(1440,900)]:
		root.size=resolution
		await process_frame
		await process_frame
		check(scene.menu.visible,"startup shows mission selection, not economy grid")
		check(scene.mission_list.get_global_rect().end.x<resolution.x,"mission menu stays inside viewport")
	for i in range(specs.size()):
		scene.current_index=i
		scene._start()
		check(scene.battle.spec.id==specs[i].id and not scene.menu.visible,"scene starts "+specs[i].id)
		var before_time: float = scene.battle.sim.time
		var before_selection: Array = scene.selected.duplicate()
		scene.objectives_button.pressed.emit()
		scene._refresh()
		check(not scene.objectives_content.visible and scene.objectives_button.visible and scene.objectives_button.text=="Hiện mục tiêu [O]",specs[i].id+" hides objective content and retains restore button")
		check(scene.battle.sim.time==before_time and scene.selected==before_selection,specs[i].id+" objective toggle preserves simulation and selection")
		scene.battle.step()
		scene._refresh()
		check(not scene.objectives_content.visible and not scene.objectives_label.text.is_empty(),specs[i].id+" hidden objectives still update after a simulation tick")
		var toggle_key := InputEventKey.new()
		toggle_key.keycode = KEY_O
		toggle_key.pressed = true
		Input.parse_input_event(toggle_key)
		await process_frame
		check(scene.objectives_content.visible and scene.objectives_button.text=="Ẩn mục tiêu [O]",specs[i].id+" O restores objectives")
	scene.free()
	passed+=1
	var report := {"passed":passed,"failed_assertions":errors.size(),"errors":errors}
	DirAccess.make_dir_recursive_absolute("res://test-results")
	var file := FileAccess.open("res://test-results/campaign.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"  "))
	print("CAMPAIGN: ",passed," cases, ",errors.size()," failures")
	quit(0 if errors.is_empty() else 1)
