class_name CampaignBattle
extends RefCounted
## Compact tactical mission host. CombatWorld owns all damage/cadence/payroll.
## This bounded circle/path adapter is separate from the Stage 1 worker traffic.

const SIZE := Vector2i(42, 30)
const DT := 0.05
var spec: Dictionary
var sim: RtsSimulation
var combat: CombatWorld
var bodies: Dictionary = {}
var points: Dictionary = {}
var goals: Array[Dictionary] = []
var escaped: Dictionary = {}
var result: String = ""
var reason: String = ""
var notice: String = ""
var detection: MissionTriggerManager
var recruit_queue: Array[Dictionary] = []
var wave_at: float = -1.0
var waves: int = 0
var path_queries: int = 0
var _rng := RandomNumberGenerator.new()
var _routes: Array[String] = []
var _wave_triggered: bool = false
var _runner: int = -1
var objective_profile: Dictionary


static func catalog() -> Array:
	return JSON.parse_string(FileAccess.get_file_as_string("res://data/missions/campaigns.v1.json"))["missions"]


func _init(mission_spec: Dictionary) -> void:
	spec = mission_spec.duplicate(true)
	objective_profile = JSON.parse_string(FileAccess.get_file_as_string("res://data/missions/campaigns.v1.json"))["objective_profile"]
	_rng.seed = 1524 + str(spec.id).hash()
	sim = RtsSimulation.new(SIZE)
	sim.faction = "league" if spec.side == "swabian_league" else "bundschuh"
	for kind in [0, 1, 2, 3]:
		sim.bank.credit(kind, 900 if kind != 3 else 200)
	combat = sim.enable_combat(0, 0, spec.get("payroll", false))
	var enemy_side := CombatTypes.Faction.BUNDSCHUH if sim.faction == "league" else CombatTypes.Faction.SWABIAN_LEAGUE
	combat.add_player(1, 1, enemy_side, ResourceBank.new())
	combat.add_player(2, 2, enemy_side, ResourceBank.new())
	combat.desertion_event.connect(_on_desertion)
	for raw: Array in spec.points:
		points[raw[0]] = {"id":raw[0], "name":raw[1], "pos":Vector2(raw[2],raw[3]), "kind":raw[4], "progress":0.0, "owned":false, "done":false, "body":-1, "released":false}
	_build_terrain()
	for raw: Dictionary in spec.goals:
		var goal := raw.duplicate(true)
		goal["progress"] = 0.0
		goal["done"] = false
		goal["visited"] = {}
		goals.append(goal)
	for actor: String in spec.actors:
		_spawn("villager", 0, Vector2(5,14 + spec.actors.find(actor)), actor, actor)
	var roster: Array = ["landsknecht_pikeman","crossbowman","heavy_gendarme"] if sim.faction == "league" else ["pikeman","peasant_flailman","crossbowman","pikeman","radical_preacher"]
	for i in range(int(spec.army)):
		_spawn(roster[i % roster.size()],0,Vector2(7+i%5,11+i/5),"soldier")
	for i in range(int(spec.carts)):
		_spawn("villager",0,Vector2(4,18+i),"cart")
	for i in range(int(spec.civilians)):
		var group := i / 4
		var pos := Vector2(13+group*5,9 if group%2==0 else 22)
		if spec.get("defense",false):
			pos = Vector2(12+i%8,10+i/8)
		_spawn("villager",0 if spec.get("defense",false) else 2,pos,"civilian")
	for i in range(int(spec.get("couriers",0))):
		_spawn("villager",0,Vector2(13+i,19),"courier")
	for point: Dictionary in points.values():
		if point.kind in ["protected","hostile","prisoner"]:
			var unit := _spawn("villager",0 if point.kind == "protected" else 1,point.pos,"structure")
			unit.max_hp = int(objective_profile.banner_hp if point.id=="banner" else (objective_profile.protected_hp if point.kind=="protected" else objective_profile.hostile_hp))
			unit.hp = unit.max_hp
			unit.attack = 0
			unit.melee_armor = int(objective_profile.melee_armor)
			unit.pierce_armor = int(objective_profile.pierce_armor)
			unit.body_radius = float(objective_profile.radius)
			point.body = unit.id
			bodies[unit.id]["point"] = point.id
			if point.kind == "prisoner":
				unit.damage_floor_hp = roundi(unit.max_hp*float(objective_profile.surrender_fraction))
		if point.kind == "capture" and not spec.get("stealth",false):
			for j in range(2):
				_spawn("peasant_flailman" if sim.faction == "league" else "landsknecht_pikeman",1,point.pos+Vector2(1.6,j*0.8),"soldier")
	if spec.get("stealth",false):
		var config := load("res://data/missions/secret_oath_default.tres").duplicate(true) as StealthMissionConfig
		config.protagonist_id = StringName(spec.actors[0])
		detection = sim.enable_stealth(config)
		for i in range(3):
			detection.register_guard(StringName("guard%d"%i),1)
	if spec.get("defense",false):
		wave_at = 45.0
	if spec.id=="A5":
		_spawn("heavy_gendarme",1,Vector2(23,15),"soldier")
		_spawn("heavy_gendarme",1,Vector2(26,15),"soldier")
	if spec.id == "B6":
		_runner = _spawn("villager",1,Vector2(25,4),"runner").id
		_move_one(_runner,Vector2(37,23))
		wave_at = 120.0


func _build_terrain() -> void:
	for y in range(SIZE.y):
		for x in range(SIZE.x):
			var cell := Vector2i(x,y)
			var road := absi(y-7)<=2 or absi(y-15)<=2 or absi(y-23)<=2 or x<12 or x>35
			var near_point := false
			for p: Dictionary in points.values():
				if Vector2(cell).distance_to(p.pos)<3.5:
					near_point = true
			var border := x==0 or y==0 or x==SIZE.x-1 or y==SIZE.y-1
			var river: bool = spec.terrain == "river" and x>=20 and x<=22 and not (absi(y-7)<=2 or absi(y-15)<=2 or absi(y-23)<=2)
			if border or river or (not road and not near_point and _rng.randf()<0.14):
				sim.grid.set_blocked(cell,-1)
			if spec.terrain in ["hill","valley"] and x>16 and y<11:
				sim.grid.set_height(cell,1)


func _spawn(type: String, owner: int, around: Vector2, tag: String, actor: String = "") -> CombatUnit:
	var pos := around
	var radius: float = float(objective_profile.radius) if tag=="structure" else float(combat.database.definition(type).body_radius)
	var found := false
	for attempt in range(400):
		var candidate := around + Vector2((attempt%17-8)*0.43,(attempt/17-5)*0.43)
		if attempt==0:
			candidate = around
		if candidate.x<1 or candidate.y<1 or candidate.x>40 or candidate.y>28 or not _static_clear(candidate,radius):
			continue
		var free := true
		for u: CombatUnit in combat.units.values():
			if u.on_field and u.alive() and u.position.distance_to(candidate)<u.body_radius+radius+0.01:
				free = false
				break
		if free:
			pos = candidate
			found = true
			break
	assert(found,"No clear scenario spawn slot within bounded search")
	var unit := combat.spawn_by_id(type,owner,pos)
	assert(unit != null)
	bodies[unit.id] = {"unit":unit,"tag":tag,"actor":actor,"goal":pos,"route_goal":pos,"path":[],"ordered":false,"hold":false,"attack":-1,"point":"","wait":0.0}
	if tag not in ["soldier","reinforcement"]:
		unit.attack = 0
	return unit


func _actor(actor: String) -> CombatUnit:
	for id: int in bodies:
		if bodies[id].actor == actor:
			return bodies[id].unit
	return null


func selectable(id: int) -> bool:
	var u: CombatUnit = combat.units.get(id)
	return u != null and u.owner_id == 0 and u.alive() and u.on_field and bodies[id].tag != "structure"


func command(ids: Array[int], pos: Vector2, attack_id: int = -1, deliberate: bool = false) -> void:
	if result != "":
		return
	if deliberate:
		for p: Dictionary in points.values():
			if p.kind == "neutral" and p.pos.distance_to(pos)<2.5:
				_finish("defeat","Lệnh tấn công chủ động đã phá đình chiến.")
				return
	var i := 0
	for id in ids:
		if not selectable(id):
			continue
		var offset := Vector2(i%5-2,i/5)*0.65 if ids.size()>1 else Vector2.ZERO
		_move_one(id,pos+offset)
		bodies[id].attack = attack_id
		i += 1


func _move_one(id: int, point: Vector2) -> void:
	bodies[id].goal = Vector2(clampf(point.x,1.1,40.5),clampf(point.y,1.1,28.5))
	bodies[id].path = []
	bodies[id].ordered = true
	bodies[id].hold = false
	combat.command_stop(combat.units[id].owner_id,id)


func stop(ids: Array[int]) -> void:
	for id in ids:
		if selectable(id):
			bodies[id].ordered = false
			bodies[id].hold = true
			bodies[id].attack = -1
			bodies[id].path = []
			combat.command_stop(0,id)


func recruit(type: String) -> bool:
	if result != "" or spec.get("stealth",false) or recruit_queue.size()>=8:
		return false
	var data := combat.database.definition(type)
	var allowed: Array = ["landsknecht_pikeman","heavy_gendarme","crossbowman"] if sim.faction=="league" else ["pikeman","peasant_flailman","crossbowman","radical_preacher"]
	if data.is_empty() or type not in allowed:
		return false
	var live := 0
	for u: CombatUnit in combat.units.values():
		if u.alive() and u.on_field and u.owner_id==0:
			live+=1
	var cost: Dictionary = {}
	for key: String in data.cost:
		cost[ResourceKind.NAMES.find(key.capitalize())] = int(data.cost[key])
	if live+recruit_queue.size()>=100 or combat.units.size()+recruit_queue.size()>=CombatWorld.MAX_UNITS or not sim.bank.try_spend(cost):
		notice = "Thiếu tài nguyên hoặc đủ 100 dân số."
		return false
	recruit_queue.append({"type":type,"seconds":float(data.train_seconds)})
	return true


func step() -> void:
	if result != "":
		return
	path_queries = 0
	_navigate()
	if detection != null:
		var actor := _actor(spec.actors[0])
		for i in range(3):
			detection.report_los(StringName("guard%d"%i),detection.protagonist_id(),actor.on_field and actor.position.distance_to(guard_position(i))<2.5)
	sim.step()
	if detection != null and detection.state == MissionTriggerManager.State.FAILED:
		_finish("defeat","Ba lần phát hiện đã được xác nhận.")
		return
	_update_points()
	_update_goals()
	_check_failure()
	if result != "":
		return
	if not recruit_queue.is_empty():
		recruit_queue[0].seconds -= DT
		if recruit_queue[0].seconds<=0 and combat.units.size()<CombatWorld.MAX_UNITS:
			_spawn(recruit_queue.pop_front().type,0,Vector2(6,18),"soldier")
	if spec.id == "B6" and _runner>0:
		var runner: CombatUnit = bodies[_runner].unit
		if runner.alive() and runner.position.distance_to(Vector2(37,23))<2:
			wave_at = minf(wave_at,sim.time+45)
			_runner = -1
			notice = "Sứ giả tới trại Đông: phản công sau 45 giây."
	if wave_at>=0 and sim.time>=wave_at and waves<6:
		_spawn_wave()
	if goals.all(func(g: Dictionary) -> bool: return g.done):
		if detection != null:
			detection.complete()
		_finish("victory",spec.ending)


func guard_position(index: int) -> Vector2:
	var anchor: Array[Vector2] = [Vector2(16,10),Vector2(25,19),Vector2(32,12)]
	return anchor[index]+Vector2(sin(sim.time*0.35+index)*2.0,cos(sim.time*0.35+index)*1.2)


func _navigate() -> void:
	for id: int in bodies:
		var unit: CombatUnit = bodies[id].unit
		var body: Dictionary = bodies[id]
		if not unit.alive() or not unit.on_field or body.tag == "structure" or unit.owner_id==2:
			continue
		var target: CombatUnit
		if unit.can_attack():
			var explicit_target: CombatUnit = combat.units.get(int(body.attack))
			if explicit_target != null and explicit_target.alive() and combat.are_enemies(unit,explicit_target):
				target = explicit_target
			if target == null:
				var nearest := 5.0 if unit.owner_id==1 else 4.0
				for other: CombatUnit in combat.units.values():
					if other.alive() and other.on_field and other.owner_id!=2 and combat.are_enemies(unit,other):
						var distance := unit.position.distance_to(other.position)
						if distance<nearest:
							nearest = distance
							target = other
		var destination: Vector2 = body.goal
		if target != null:
			combat.command_attack(unit.owner_id,id,target.id)
			if CombatWorld.in_weapon_range(unit,target) or body.hold:
				continue
			destination = target.position
		else:
			combat.command_stop(unit.owner_id,id)
			if not body.ordered:
				continue
		if Vector2(body.route_goal).distance_to(destination)>0.8:
			body.path = []
			body.route_goal = destination
		if unit.position.distance_to(destination)<0.18:
			body.ordered = false
			body.path = []
			continue
		if body.path.is_empty() and path_queries<6:
			var start := Vector2i(unit.position.floor())
			var end := Vector2i(destination.floor())
			if sim.grid.walkable(end):
				body.path = Array(sim.grid.astar.get_id_path(start,end))
				path_queries += 1
		if body.path.is_empty():
			continue
		var next := Vector2(body.path[0])+Vector2(0.5,0.5)
		if body.path.size()==1:
			next = destination
		if unit.position.distance_to(next)<0.16:
			body.path.pop_front()
			continue
		var direction := unit.position.direction_to(next)
		for angle: float in [0.0,0.7,-0.7,1.3,-1.3]:
			var candidate := unit.position+direction.rotated(angle)*minf(unit.movement_budget(DT),unit.position.distance_to(next))
			if _can_move(unit,candidate):
				combat.set_position(id,candidate)
				break


func _can_move(unit: CombatUnit, candidate: Vector2) -> bool:
	if not _static_clear(candidate,unit.body_radius):
		return false
	for other: CombatUnit in combat.units.values():
		if other.id==unit.id or not other.alive() or not other.on_field:
			continue
		var closest := Geometry2D.get_closest_point_to_segment(other.position,unit.position,candidate)
		if closest.distance_to(other.position)<unit.body_radius+other.body_radius-0.005:
			return false
	return true


func _static_clear(point: Vector2, radius: float) -> bool:
	for y in range(floori(point.y-radius),floori(point.y+radius)+1):
		for x in range(floori(point.x-radius),floori(point.x+radius)+1):
			if sim.grid.walkable(Vector2i(x,y)):
				continue
			var closest := Vector2(clampf(point.x,x,x+1),clampf(point.y,y,y+1))
			if point.distance_to(closest)<radius-0.00001:
				return false
	return true


func _near(point: Vector2, owner: int, soldiers_only: bool = false, radius: float = 3.0) -> Array[CombatUnit]:
	var found: Array[CombatUnit] = []
	for u: CombatUnit in combat.units.values():
		var matches: bool = u.owner_id==owner or (owner==1 and u.owner_id!=0 and u.owner_id!=2)
		if matches and u.alive() and u.on_field and bodies[u.id].tag!="structure" and u.position.distance_to(point)<=radius:
			if not soldiers_only or bodies[u.id].tag in ["soldier","reinforcement"]:
				found.append(u)
	return found


func _update_points() -> void:
	for point: Dictionary in points.values():
		if point.kind == "capture":
			var ours := _near(point.pos,0,true).size()>=3
			var contested := not _near(point.pos,1,true,4).is_empty()
			if ours and not contested:
				point.progress = minf(6,point.progress+DT)
			elif not ours:
				point.progress = maxf(0,point.progress-DT*2)
			point.owned = point.progress>=6 and not contested
		if point.kind=="prisoner" and not point.released:
			var proxy: CombatUnit = bodies[int(point.body)].unit
			if proxy.hp<=proxy.damage_floor_hp:
				combat.transfer_unit(proxy.id,2)
				point.progress = point.progress+DT if _near(point.pos,0,true).size()>0 else 0.0
				if point.progress>=6:
					combat.remove_unit(proxy.id)
					_spawn("villager",0,point.pos,"prisoner")
					point.released = true
					notice = "Chỉ huy đã đầu hàng; chọn tù binh để hộ tống về trạm."
		if spec.get("reinforcements",false) and point.id in ["r1","r2","r3"] and not point.released:
			var hero := _actor("muentzer")
			var ready: bool = hero.position.distance_to(point.pos)<2.5 if point.kind!="capture" else bool(point.owned)
			if ready and (point.kind!="supply_route" or sim.bank.try_spend({0:300})):
				point.released = true
				_routes.append(point.id)
				var messenger := _spawn("villager",0,point.pos,"messenger")
				bodies[messenger.id]["route"] = point.id
				for i in range(12):
					var reinforcement := _spawn("pikeman" if i%2==0 else "peasant_flailman",0,point.pos,"reinforcement")
					bodies[reinforcement.id]["route"] = point.id
	for id: int in bodies.keys():
		var u: CombatUnit = bodies[id].unit
		if u.owner_id==2 and bodies[id].tag=="civilian" and u.alive() and not _near(u.position,0,false,2.5).is_empty():
			combat.transfer_unit(id,0)
			notice = "Người theo đã gia nhập. Chọn nhóm để đưa tới cửa thoát."
	if not _wave_triggered and not spec.get("stealth",false):
		var owned := 0
		for p: Dictionary in points.values():
			if p.owned:
				owned+=1
		var delivered := false
		for g: Dictionary in goals:
			if g.kind=="visit" and not g.visited.is_empty():
				delivered = true
		var trigger: bool = delivered if spec.id=="A2" else (owned>=1 if spec.id=="B5" else owned>=2)
		if trigger and spec.id!="B6":
			_wave_triggered = true
			wave_at = sim.time+45
			notice = "Trinh sát: phản công từ bờ Đông sau 45 giây."


func _update_goals() -> void:
	for index in range(goals.size()):
		var g: Dictionary = goals[index]
		if g.done or (g.has("after") and not goals[int(g.after)].done):
			continue
		match g.kind:
			"control":
				var count := 0
				for id: String in g.ids:
					if points[id].owned:
						count+=1
				g.progress = g.progress+DT if count>=int(g.required) else 0.0
				g.done = g.progress>=float(g.seconds)
			"visit":
				var actor := _actor(g.actor)
				for id: String in g.ids:
					if g.visited.get(id,false):
						continue
					var p: Dictionary = points[id]
					var enough := _near(p.pos,0,false).size()>=int(g.escort)+1
					var clear := _near(p.pos,1,true,4).is_empty()
					p.progress = p.progress+DT if actor.on_field and actor.position.distance_to(p.pos)<2.5 and enough and clear else 0.0
					if p.progress>=float(g.seconds):
						g.visited[id] = true
						p.done = true
				g.progress = g.visited.size()
				g.done = g.visited.size()==g.ids.size()
			"escape":
				for id: int in bodies:
					var u: CombatUnit = bodies[id].unit
					if not selectable(id) or bodies[id].tag not in g.tags:
						continue
					for p: Dictionary in points.values():
						if (p.id==g.to or (g.to=="any_exit" and p.kind=="exit")) and u.position.distance_to(p.pos)<2.4:
							escaped[id] = bodies[id].tag
							combat.remove_unit(id)
				var counts: Dictionary = {}
				var count := 0
				for tag: String in escaped.values():
					if tag in g.tags:
						count+=1
						counts[tag] = int(counts.get(tag,0))+1
				g.progress = count
				g.done = count>=int(g.required)
				for tag: String in g.get("minimums",{}):
					g.done = g.done and int(counts.get(tag,0))>=int(g.minimums[tag])
				if spec.get("reinforcements",false):
					g.done = g.done and _possible_route_pair(true)
			"supply":
				var actor := _actor(g.actor)
				if actor.position.distance_to(points[g.point].pos)<2.5 and sim.bank.try_spend({0:int(g.amount)}):
					g.done = true
					g.progress = g.amount
			"destroy":
				var count := 0
				for id: String in g.ids:
					if bodies[int(points[id].body)].unit.hp<=0:
						count+=1
				g.progress = count
				g.done = count>=int(g.required)
			"survive":
				g.progress = minf(sim.time,float(g.seconds))
				g.done = sim.time>=float(g.seconds) and bodies[int(points[g.point].body)].unit.alive()
			"routes":
				g.progress = _routes.size()
				g.done = _routes.size()>=int(g.required)


func _check_failure() -> void:
	for actor: String in spec.actors:
		if not _actor(actor).alive():
			_finish("defeat","Nhân vật bắt buộc đã ngã xuống: "+actor)
	for g: Dictionary in goals:
		if g.kind=="survive" and not g.done and not bodies[int(points[g.point].body)].unit.alive():
			_finish("defeat","Mất mục tiêu cần bảo vệ: "+points[g.point].name)
		if g.kind=="escape" and not g.done:
			var alive := 0
			var counts: Dictionary = {}
			for id: int in bodies:
				if bodies[id].tag in g.tags and bodies[id].unit.alive():
					alive+=1
					var tag: String = bodies[id].tag
					counts[tag] = int(counts.get(tag,0))+1
			# Reinforcements and prisoners can still become available later.
			if spec.get("prisoners",false):
				for p: Dictionary in points.values():
					if p.kind=="prisoner" and not p.released:
						alive+=1
				if alive<int(g.required):
					_finish("defeat","Một tù binh bắt buộc đã chết trước khi về trạm.")
			if spec.get("reinforcements",false) and not _possible_route_pair(false):
				_finish("defeat","Không còn hai tuyến có thể đưa đủ sứ giả và 16 quân viện về trại.")
			if not spec.get("reinforcements",false) and not spec.get("prisoners",false):
				if alive<int(g.required):
					_finish("defeat","Không còn đủ đối tượng mang ID nhiệm vụ để hoàn tất.")
				for tag: String in g.get("minimums",{}):
					if int(counts.get(tag,0))<int(g.minimums[tag]):
						_finish("defeat","Không còn đủ "+tag+" có thể cứu.")
	if spec.has("protect_any"):
		var living := false
		for id: String in spec.protect_any:
			living = living or bodies[int(points[id].body)].unit.alive()
		if not living:
			_finish("defeat","Không còn công trình nhiệm vụ cần bảo vệ.")
	if spec.has("protect_until_supply") and not goals[1].done and not bodies[int(points[spec.protect_until_supply].body)].unit.alive():
		_finish("defeat","Kho cứu tế bị phá trước khi giao đủ Food.")
	if spec.has("deadline") and sim.time>=float(spec.deadline) and not goals.all(func(g: Dictionary) -> bool: return g.done):
		_finish("defeat","Đã hết thời gian sơ tán.")
	if not spec.get("stealth",false) and recruit_queue.is_empty():
		var soldiers := false
		for u: CombatUnit in combat.units.values():
			if u.owner_id==0 and u.can_attack():
				soldiers = true
		var cheapest: Dictionary = combat.database.definition("peasant_flailman" if sim.faction=="bundschuh" else "crossbowman").cost
		var can_rebuild := sim.bank.amount(0)>=int(cheapest.food) and sim.bank.amount(1)>=int(cheapest.wood) and sim.bank.amount(2)>=int(cheapest.gold)
		if not soldiers and not can_rebuild and goals.any(func(g: Dictionary) -> bool: return g.kind in ["control","destroy"] and not g.done):
			_finish("defeat","Không còn lực lượng hoặc tài nguyên để giành mục tiêu.")


func _possible_route_pair(only_escaped: bool) -> bool:
	var counts: Dictionary = {}
	for route: String in ["r1","r2","r3"]:
		counts[route] = {"messenger":0,"reinforcement":0}
		if not only_escaped and not points[route].released:
			counts[route] = {"messenger":1,"reinforcement":12}
	for id: int in bodies:
		var body: Dictionary = bodies[id]
		if not body.has("route") or not body.unit.alive() or (only_escaped and not escaped.has(id)):
			continue
		counts[body.route][body.tag] += 1
	var routes: Array = counts.keys()
	for a in range(routes.size()):
		for b in range(a+1,routes.size()):
			var first: Dictionary = counts[routes[a]]
			var second: Dictionary = counts[routes[b]]
			if first.messenger>=1 and second.messenger>=1 and first.reinforcement+second.reinforcement>=16:
				return true
	return false


func _spawn_wave() -> void:
	waves+=1
	var count := 4+waves if spec.get("defense",false) else 4
	if waves> (6 if spec.get("defense",false) else 3):
		wave_at = -1
		return
	for i in range(count):
		if combat.units.size()>=190:
			break
		var type := "peasant_flailman" if sim.faction=="league" else ("heavy_gendarme" if i%3==0 else "landsknecht_pikeman")
		var u := _spawn(type,1,Vector2(38,7+8*(waves%3)),"soldier")
		_move_one(u.id,Vector2(20,15) if spec.get("defense",false) else Vector2(8,15))
	wave_at = sim.time+(30 if spec.get("defense",false) else 60)
	notice = "Đợt địch %d đã vào từ mép Đông. Ngân sách viện quân hữu hạn."%waves


func _finish(outcome: String, text: String) -> void:
	if result == "":
		result = outcome
		reason = text


func _on_desertion(_event: Dictionary) -> void:
	notice = "Gold về 0: Landsknecht đã đào ngũ sang phe thù địch."


func goal_text(g: Dictionary) -> String:
	var target: float = g.get("seconds",g.get("required",g.get("amount",g.get("ids",[]).size())))
	if g.kind == "visit":
		target = g.ids.size()
	return ("✓ " if g.done else "○ ")+g.label+"  %d/%d"%[g.progress,target]
