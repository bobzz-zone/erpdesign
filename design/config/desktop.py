# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from frappe import _

def get_data():
	return [
		{
			"module_name": "Design",
			"color": "blue",
			"icon": "octicon octicon-mortar-board",
			"type": "module",
			"label": _("Design")
		},
		{
                        "module_name": "Construction",
                        "color": "red",
                        "icon": "octicon octicon-paintcan",
                        "type": "module",
                        "label": _("Construction")
                },
                {
                        "module_name": "Procurement",
                        "color": "Black",
                        "icon": "octicon octicon-clippy",
                        "type": "module",
                        "label": _("Procurement")
                }


	]
