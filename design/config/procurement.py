from frappe import _

def get_data():
	return [
		{
		"label":"Documents",
		"items":[
			{
				"type":"doctype",
				"name":"Supplier"
			},
			{
				"type":"doctype",
				"name":"Material Request"
			},
			{
				"type":"doctype",
				"name":"Supplier Quotation"
			},{
				"type":"doctype",
				"name":"Purchase Order"
			},{
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
			}
		]
		}
	]
