// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

/** Badges liste : couleurs par niveau (alignées sur le formulaire U0→U3). */
function ticket_commercial_urgence_niveau_badge(value) {
    if (!value) {
        return "";
    }
    const color_config = {
        U0: { bg: "rgba(5, 150, 105, 0.14)", text: "#065f46" },
        U1: { bg: "rgba(234, 179, 8, 0.22)", text: "#854d0e" },
        U2: { bg: "rgba(234, 88, 12, 0.16)", text: "#c2410c" },
        U3: { bg: "rgba(220, 38, 38, 0.14)", text: "#b91c1c" }
    };
    const config = color_config[value] || { bg: "rgba(100, 116, 139, 0.12)", text: "#475569" };
    return `<span style="background-color: ${config.bg}; color: ${config.text}; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 500; display: inline-block;">${frappe.utils.escape_html(
        value
    )}</span>`;
}

function ticket_commercial_list_muted_dash() {
    return `<span style="color: #94a3b8; font-size: 12px;">\u2014</span>`;
}

frappe.listview_settings["Ticket Commercial"] = {
    hide_name_column: true,
    add_fields: ["priority"],

    formatters: {
        niveau_urgence(value) {
            return ticket_commercial_urgence_niveau_badge(value);
        },

        niveau_urgence_demande(value) {
            if (!value) {
                return ticket_commercial_list_muted_dash();
            }
            return ticket_commercial_urgence_niveau_badge(value);
        },

        statut_demande_urgence(value) {
            if (!value || value === "Aucune") {
                return ticket_commercial_list_muted_dash();
            }
            const color_config = {
                "En attente": { bg: "rgba(234, 179, 8, 0.22)", text: "#854d0e" },
                Validée: { bg: "rgba(5, 150, 105, 0.14)", text: "#065f46" },
                Refusée: { bg: "rgba(220, 38, 38, 0.14)", text: "#b91c1c" }
            };
            const config = color_config[value] || { bg: "rgba(100, 116, 139, 0.12)", text: "#475569" };
            return `<span style="background-color: ${config.bg}; color: ${config.text}; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 500; display: inline-block;">${frappe.utils.escape_html(
                value
            )}</span>`;
        },

        priority: function(value) {
            // Formatter le champ priority avec exactement le même style que le statut
            if (!value) return "";

            // Configuration des couleurs avec exactement le même style que le statut (fond très clair, texte coloré)
            let color_config = {
                "Basse": { bg: "rgba(40, 167, 69, 0.1)", text: "#28a745" },      // Vert clair comme "Terminé"
                "Moyenne": { bg: "rgba(255, 87, 34, 0.1)", text: "#ff5722" },     // Orange exactement comme "En cours"
                "Haute": { bg: "rgba(220, 53, 69, 0.1)", text: "#dc3545" }        // Rouge clair comme "Annulé"
            };

            let config = color_config[value] || { bg: "rgba(108, 117, 125, 0.1)", text: "#6c757d" };

            // Style exactement comme le statut : fond très clair, texte coloré, coins arrondis
            return `<span style="background-color: ${config.bg}; color: ${config.text}; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 500; display: inline-block;">${value}</span>`;
        }
    }
};
