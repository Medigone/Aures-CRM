// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.listview_settings["Ticket Commercial"] = {
    add_fields: ["priority"],
    
    formatters: {
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

