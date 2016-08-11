from frappe import _

def get_data():
	return [
		{
		"label":"Documents",
		"items":[
				{
					"type":"doctype",
					"name":"Project"
				},{
					"type":"doctype",
					"name":"Task"
				},
				{
					"type": "report",
					"route": "Gantt/Task",
					"doctype": "Task",
					"name": "Gantt Chart",
					"description": _("Gantt chart of all tasks.")
				}
				,{
					"type":"doctype",
					"name":"Design Order"
				},{
					"type":"doctype",
					"name":"Drawing Submittal Form"
				},{
					"type":"doctype",
					"name":"Shop drawing order"
				}
			]
		}
	]
