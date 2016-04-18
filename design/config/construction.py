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
				},{
					"type":"doctype",
					"name":"Site inspection"
				},{
					"type":"doctype",
					"name":"Site Visit"
				},{
					"type":"doctype",
					"name":"Project Work Center"
				},{
					"type":"doctype",
					"name":"Project Budget From"
				},{
					"type": "report",
					"route": "Gantt/Task",
					"doctype": "Task",
					"name": "Gantt Chart",
					"description": _("Gantt chart of all tasks.")
				}
				
			]
		}
	]
