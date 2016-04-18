from frappe import _

def get_data():
	return [
		{
		"label":"Documents",
		"items":[
			{
				"type":"doctype",
				"name":"Call For Bid"
			},{
				"type":"doctype",
				"name":"RFQ subcontractor"
			},{
				"type":"doctype",
				"name":"RFQ supplier"
			},{
				"type":"doctype",
				"name":"Supplier evaluation form"
			},{
				"type":"doctype",
				"name":"Purchase Order"
			}

		}
	]
