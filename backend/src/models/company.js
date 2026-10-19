const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        website: {
            type: String,
            trim: true
        },
        industry: {
            type: String,
            default: ""
        },
        category: {
            type: String,
            default: "Other"
        },
        research: {
            type: String,
            default: ""
        },
        researchedAt: {
            type: Date,
            default: null
        },
        sources: {
            type: [
                {
                    title: {
                        type: String,
                        default: ""
                    },
                    url: {
                        type: String,
                        default: ""
                    },
                    evidence: {
                        type: String,
                        default: ""
                    }
                }
            ],
            default: []
        },
        score: {
            type: Number,
            default: 0
        },
        eventFit: {
            type: Number,
            default: 0
        },
        sponsorshipEvidence: {
            type: Number,
            default: 0
        },
        educationCommunityFit: {
            type: Number,
            default: 0
        },
        productRelevance: {
            type: Number,
            default: 0
        },
        audienceFit: {
            type: Number,
            default: 0
        },
        sponsorshipPotential: {
            type: Number,
            default: 0
        },
        recommendedTier: {
            type: String,
            default: "Bronze"
        },
        recommendedAsk: {
            type: String,
            enum: ["money", "goodies", "infra"],
            default: "money"
        },
        whyGoodSponsor: {
            type: String,
            default: ""
        },
        strategy: {
            type: String,
            default: ""
        },
        whatToAsk: {
            type: String,
            default: ""
        },
        shortPitch: {
            type: String,
            default: ""
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        confidence: {
            type: String,
            enum: ["HIGH", "MEDIUM", "LOW", "UNVERIFIED"],
            default: "UNVERIFIED"
        },
        contactName: {
            type: String,
            default: ""
        },
        contactEmail: {
            type: String,
            default: ""
        },
        contactRole: {
            type: String,
            default: ""
        },
        linkedinUrl: {
            type: String,
            default: ""
        },
        discoveredContacts: {
            type: [
                {
                    role: { type: String, default: "Sponsorships" },
                    email: { type: String, default: "" },
                    confidence: { type: String, default: "HIGH" },
                    source: { type: String, default: "Domain Discovery" }
                }
            ],
            default: []
        },
        sponsorshipHistory: {
            type: [
                {
                    eventName: {
                        type: String,
                        default: ""
                    },
                    year: {
                        type: Number,
                        default: null
                    },
                    tier: {
                        type: String,
                        default: ""
                    },
                    askType: {
                        type: String,
                        enum: ["money", "goodies", "infra", "other"],
                        default: "money"
                    },
                    amountOrValue: {
                        type: String,
                        default: ""
                    },
                    notes: {
                        type: String,
                        default: ""
                    }
                }
            ],
            default: []
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

module.exports = mongoose.model("Company", companySchema);