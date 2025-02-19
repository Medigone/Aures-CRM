app_name = "aurescrm"
app_title = "Aures CRM"
app_publisher = "Medigo"
app_description = "CRM"
app_email = "admin@medigo.one"
app_license = "mit"
# required_apps = []

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/aurescrm/css/aurescrm.css"
# app_include_js = "/assets/aurescrm/js/aurescrm.js"

# include js, css files in header of web template
# web_include_css = "/assets/aurescrm/css/aurescrm.css"
# web_include_js = "/assets/aurescrm/js/aurescrm.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "aurescrm/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}


# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "aurescrm/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "aurescrm.utils.jinja_methods",
# 	"filters": "aurescrm.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "aurescrm.install.before_install"
# after_install = "aurescrm.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "aurescrm.uninstall.before_uninstall"
# after_uninstall = "aurescrm.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "aurescrm.utils.before_app_install"
# after_app_install = "aurescrm.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "aurescrm.utils.before_app_uninstall"
# after_app_uninstall = "aurescrm.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "aurescrm.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

override_doctype_dashboards = {
    "Customer": "aurescrm.custom_customer_dashboard.get_data"
}



# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# aurescrm/hooks.py
# dans hooks.py
doc_events = {
    "Fiche Evaluation Clients": {
        "after_insert": "aurescrm.fiche_evaluation_client.calculate_global_score"
    },
    "Customer": {
        "before_save": "aurescrm.customer_hooks.uppercase_customer_name"
    },
    "Item": {
        "autoname": "aurescrm.utils.custom_item_naming",
        "after_insert": "aurescrm.aures_crm.doctype.etude_technique_offset.etude_technique_offset.create_etude_technique_offset"
    },
    "Adresses de livraison": {
        "before_save": "aurescrm.utils.custom_delivery_address_naming"
    }
}

# aurescrm/hooks.py


# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------
scheduler_events = {
    "cron": {
        "0 2 * * *": [
            "aurescrm.aures_crm.doctype.reclamations_clients.reclamations_clients.update_reclamations_status"
        ]
    }
}


# scheduler_events = {
# 	"all": [
# 		"aurescrm.tasks.all"
# 	],
# 	"daily": [
# 		"aurescrm.tasks.daily"
# 	],
# 	"hourly": [
# 		"aurescrm.tasks.hourly"
# 	],
# 	"weekly": [
# 		"aurescrm.tasks.weekly"
# 	],
# 	"monthly": [
# 		"aurescrm.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "aurescrm.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "aurescrm.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "aurescrm.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["aurescrm.utils.before_request"]
# after_request = ["aurescrm.utils.after_request"]

# Job Events
# ----------
# before_job = ["aurescrm.utils.before_job"]
# after_job = ["aurescrm.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"aurescrm.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

fixtures = [
    # "Custom HTML Block",
    # "Role",
    # "Client Script",
    # "Document Naming Rule",
    # "Workflow",
    # "Workflow State",
    # "Workflow Transition",
    # "Workflow Action",
    # "Workflow Action Master",
    # "Workflow Document State",
    # "DocPerm"
]
