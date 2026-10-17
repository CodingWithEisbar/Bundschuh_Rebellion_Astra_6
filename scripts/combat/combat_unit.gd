class_name CombatUnit
extends RefCounted
## Data model, no Node or per-unit callbacks. CombatWorld owns lifecycle/teams.
## Position is the ACTUAL body center in tiles, supplied by navigation, never a
## reserved A* destination. Large cavalry/siege collision is not implemented here.

var id: int
var owner_id: int
var team_id: int
var faction: int
var kind: int
var definition_id: String = ""
var database_sha256: String = ""
var database_generation: int = 0
var base_cost: Dictionary = {}
var population: int = 1
var train_seconds: float = 0.0
var zeal: Dictionary = {}
var position: Vector2
var elevation: float = 0.0 # Vertical height; position.y is map north/south.
var on_field: bool = true # False while garrisoned/transported; still on payroll.
var mutinous: bool = false
var max_hp: int
var hp: int
var damage_floor_hp: int = 0 # Scenario-only nonlethal surrender; default combat unchanged.
var attack: int
var melee_armor: int
var pierce_armor: int
var channel: int
var armor_classes: Dictionary = {} # Set: prevents duplicate class bonuses.
var bonuses: Dictionary
var bonus_armor: Dictionary
var base_movement_speed: float
var base_attack_period: float
var attack_range: float
var minimum_range: float
var body_radius: float
var modifiers := CombatStatModifiers.new()
# Recovery is measured in BASE attack seconds. A rate change affects remaining
# recovery immediately without resetting a swing or granting a free extra hit.
var recovery_work: float = 0.0
# Optional Stage 4 wind-up, expressed as a fraction of the base attack cycle.
# Legacy fixtures keep 0. Animation samples these authoritative work counters;
# a culled, paused or missing sprite can never prevent simulation damage.
var impact_fraction: float = 0.0
var attack_serial: int = 0
var attack_cycle_work: float = 0.0
var attack_elapsed_work: float = 0.0
var attack_impact_work: float = 0.0
var swing_pending: bool = false
var swing_cancelled: bool = false


func _init(entity_id: int, owner: int, team: int, side: int,
		point: Vector2, data: Dictionary) -> void:
	id = entity_id
	owner_id = owner
	team_id = team
	faction = side
	position = point
	kind = int(data["kind"])
	definition_id = data.get("definition_id", "")
	database_sha256 = data.get("database_sha256", "")
	database_generation = int(data.get("database_generation", 0))
	base_cost = data.get("cost", {}).duplicate()
	population = int(data.get("population", 1))
	train_seconds = float(data.get("train_seconds", 0.0))
	zeal = data.get("zeal", {}).duplicate()
	impact_fraction = float(data.get("impact_fraction", 0.0))
	max_hp = int(data["max_hp"])
	hp = max_hp
	attack = int(data["attack"])
	melee_armor = int(data["melee_armor"])
	pierce_armor = int(data["pierce_armor"])
	channel = int(data["channel"])
	for armor_class: int in data["armor_classes"]:
		armor_classes[armor_class] = true
	bonuses = data["bonuses"].duplicate()
	bonus_armor = data["bonus_armor"].duplicate()
	base_movement_speed = float(data["movement_speed"])
	base_attack_period = float(data["attack_period"])
	attack_range = float(data["attack_range"])
	minimum_range = float(data["minimum_range"])
	body_radius = float(data["body_radius"])


func alive() -> bool:
	return hp > 0


func can_attack() -> bool:
	return alive() and on_field and attack > 0 and base_attack_period > 0.0


func attack_period() -> float:
	return base_attack_period / modifiers.attack_rate


func movement_speed() -> float:
	return base_movement_speed * modifiers.movement_rate


func movement_budget(seconds: float) -> float:
	## Navigation consumes this distance budget after enforcing terrain/traffic.
	## This method does NOT teleport or bypass the Stage 1 occupancy controller.
	assert(is_finite(seconds) and seconds >= 0.0)
	return movement_speed() * seconds if alive() and on_field else 0.0


func receive_damage(amount: int) -> int:
	assert(amount >= 0)
	var removed := mini(maxi(0, hp - damage_floor_hp), amount)
	hp -= removed
	return removed
