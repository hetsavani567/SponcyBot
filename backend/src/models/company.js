
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
        sources: {
            type: [String],
            default: []
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
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Company", companySchema);