const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "internships.json");

function loadInternships() {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function searchInternships(args = {}) {

    const internships = loadInternships();

    const {
        skill,
        paidOnly = false,
        remoteOnly = false
    } = args;

    return internships.filter(internship => {

        if (paidOnly && !internship.paid) {
            return false;
        }

        if (remoteOnly && !internship.remote) {
            return false;
        }

        if (skill) {

            const requestedSkill = skill.toLowerCase();

            const matches = internship.skills.some(
                item => item.toLowerCase().includes(requestedSkill)
            );

            if (!matches) {
                return false;
            }
        }

        return true;
    });
}


function filterByDeadline(internships, days = 30) {

    const now = new Date();

    const limit = new Date(now);
    limit.setDate(limit.getDate() + days);

    return internships.filter(internship => {

        const deadline = new Date(internship.deadline);

        return deadline <= limit;
    });
}


function rankInternships(internships) {

    return [...internships].sort((a, b) => {

        let scoreA = 0;
        let scoreB = 0;

        if (a.paid) {
            scoreA += 30;
        }

        if (b.paid) {
            scoreB += 30;
        }

        if (a.remote) {
            scoreA += 10;
        }

        if (b.remote) {
            scoreB += 10;
        }

        scoreA += a.skills.length * 5;
        scoreB += b.skills.length * 5;

        return scoreB - scoreA;
    });
}


module.exports = {
    searchInternships,
    filterByDeadline,
    rankInternships
};
