# -*- coding: utf-8 -*-
# Copyright (c) 2015, bobzz.zone@gmail.com and contributors
# For license information, please see license.txt
from __future__ import unicode_literals
import frappe
from frappe import db,throw,msgprint
from frappe.utils import flt,cint,cstr
from frappe.model.document import Document


class CallForBid(Document):
	pass
	def make_quotation(self):
		if not self.product or len(self.product)==0:
			frappe.throw("Please enter the product")
		if not self.supplier or len(self.supplier)==0:
			frappe.throw("Please specify the supplier")
		created=""
		for s in self.supplier:
			if s.created==0:
				product=[]
				for p in self.product:
					product.append({
						"doctype":"Supplier Quotation Item",
						"item_code":p.item,
						"qty":flt(p.qty),
						"warehouse":p.warehouse
					})
				quote = {
						"doctype":"Supplier Quotation",
						"supplier":s.supplier,
						"call_for_bid":self.name,
						"transaction_date":self.date,
						"items":product
					}
				#quote.extend(product)
				row=frappe.get_doc(quote)
				row.insert(ignore_permissions=True)
				frappe.db.sql("""update `tabCall For Bid Supplier` set created=1,quotation="{}"  where name="{}"; """.format(row.name,s.name))
				s.quotation=row.name
				s.created=1
				created = created + row.name
		if created=="":
			msgprint("Nothing is Created")
		else:
			msgprint("Quotation Created "+created)


def submit_quotation(doc,method):
	if doc.call_for_bid:
		frappe.db.sql("""update `tabCall For Bid Supplier` set received=1 , price={} where quotation="{}"; """.format(doc.total,doc.name))

def cancel_quotation(doc,method):
	if doc.call_for_bid:
		frappe.db.sql("""update `tabCall For Bid Supplier` set received=0,created=0,quotation="" , price=0 where quotation="{}"; """.format(doc.name))

def trash_quotation(doc,method):
	if doc.call_for_bid:
		frappe.db.sql("""update `tabCall For Bid Supplier` set received=0,created=0,quotation="" , price=0 where quotation="{}"; """.format(doc.name))
		