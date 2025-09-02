const fs = require('fs');
const path = require('path');

const BUSINESS_DATA_FILE = path.join(__dirname, '../../../business-data.json');

// Business types users can own
const BUSINESS_TYPES = {
    corner_store: {
        name: 'Corner Store',
        emoji: '🏪',
        purchase_price: 25000,
        daily_income: { min: 500, max: 1500 },
        max_employees: 2,
        employee_cost: 200,
        description: 'Small neighborhood convenience store'
    },
    restaurant: {
        name: 'Restaurant',
        emoji: '🍽️',
        purchase_price: 75000,
        daily_income: { min: 1500, max: 4000 },
        max_employees: 5,
        employee_cost: 350,
        description: 'Popular dining establishment'
    },
    nightclub: {
        name: 'Nightclub',
        emoji: '🎭',
        purchase_price: 150000,
        daily_income: { min: 3000, max: 8000 },
        max_employees: 8,
        employee_cost: 500,
        description: 'High-end entertainment venue'
    },
    casino: {
        name: 'Casino',
        emoji: '🎰',
        purchase_price: 500000,
        daily_income: { min: 8000, max: 20000 },
        max_employees: 15,
        employee_cost: 800,
        description: 'Luxury gambling establishment'
    },
    bank: {
        name: 'Private Bank',
        emoji: '🏦',
        purchase_price: 1000000,
        daily_income: { min: 15000, max: 40000 },
        max_employees: 20,
        employee_cost: 1200,
        description: 'Elite financial institution'
    },
    // ILLEGAL BUSINESSES
    drug_lab: {
        name: 'Drug Laboratory',
        emoji: '🧪',
        purchase_price: 200000,
        daily_income: { min: 5000, max: 12000 },
        max_employees: 6,
        employee_cost: 600,
        description: 'Underground drug manufacturing facility',
        illegal: true,
        risk: 0.15
    },
    chop_shop: {
        name: 'Chop Shop',
        emoji: '🚗',
        purchase_price: 120000,
        daily_income: { min: 3000, max: 8000 },
        max_employees: 4,
        employee_cost: 400,
        description: 'Stolen vehicle dismantling operation',
        illegal: true,
        risk: 0.12
    },
    counterfeit_shop: {
        name: 'Counterfeit Shop',
        emoji: '💵',
        purchase_price: 300000,
        daily_income: { min: 6000, max: 15000 },
        max_employees: 8,
        employee_cost: 700,
        description: 'Fake money and document production',
        illegal: true,
        risk: 0.20
    },
    smuggling_ring: {
        name: 'Smuggling Ring',
        emoji: '📦',
        purchase_price: 400000,
        daily_income: { min: 8000, max: 18000 },
        max_employees: 10,
        employee_cost: 800,
        description: 'International contraband trafficking',
        illegal: true,
        risk: 0.25
    },
    underground_casino: {
        name: 'Underground Casino',
        emoji: '🎲',
        purchase_price: 600000,
        daily_income: { min: 12000, max: 25000 },
        max_employees: 12,
        employee_cost: 900,
        description: 'Illegal high-stakes gambling den',
        illegal: true,
        risk: 0.18
    },
    money_laundering: {
        name: 'Money Laundering Front',
        emoji: '🏧',
        purchase_price: 800000,
        daily_income: { min: 15000, max: 35000 },
        max_employees: 15,
        employee_cost: 1000,
        description: 'Cleans dirty money through legitimate businesses',
        illegal: true,
        risk: 0.30
    }
};

// Employee types with different skills
const EMPLOYEE_TYPES = {
    cashier: {
        name: 'Cashier',
        emoji: '💰',
        hire_cost: 1000,
        daily_wage: 200,
        income_boost: 0.10,
        description: 'Handles transactions efficiently'
    },
    security: {
        name: 'Security Guard',
        emoji: '🛡️',
        hire_cost: 2000,
        daily_wage: 300,
        robbery_protection: 0.25,
        description: 'Protects against robberies'
    },
    manager: {
        name: 'Manager',
        emoji: '👔',
        hire_cost: 3000,
        daily_wage: 500,
        income_boost: 0.20,
        efficiency_boost: 0.15,
        description: 'Improves overall operations'
    },
    accountant: {
        name: 'Accountant',
        emoji: '📊',
        hire_cost: 2500,
        daily_wage: 400,
        tax_reduction: 0.15,
        description: 'Reduces tax burden'
    },
    // CRIMINAL EMPLOYEES
    enforcer: {
        name: 'Enforcer',
        emoji: '🔫',
        hire_cost: 5000,
        daily_wage: 800,
        income_boost: 0.15,
        robbery_protection: 0.40,
        description: 'Intimidates competitors and protects operations',
        criminal: true
    },
    chemist: {
        name: 'Chemist',
        emoji: '⚗️',
        hire_cost: 8000,
        daily_wage: 1200,
        income_boost: 0.30,
        description: 'Improves drug quality and production',
        criminal: true,
        business_types: ['drug_lab']
    },
    hacker: {
        name: 'Hacker',
        emoji: '💻',
        hire_cost: 6000,
        daily_wage: 1000,
        income_boost: 0.25,
        risk_reduction: 0.20,
        description: 'Covers digital tracks and launders money',
        criminal: true
    },
    corrupt_cop: {
        name: 'Corrupt Cop',
        emoji: '👮‍♂️',
        hire_cost: 15000,
        daily_wage: 2000,
        risk_reduction: 0.50,
        description: 'Provides police protection and warnings',
        criminal: true
    },
    smuggler: {
        name: 'Smuggler',
        emoji: '🚚',
        hire_cost: 7000,
        daily_wage: 1100,
        income_boost: 0.20,
        description: 'Handles transportation of illegal goods',
        criminal: true,
        business_types: ['smuggling_ring', 'drug_lab']
    },
    forger: {
        name: 'Forger',
        emoji: '🖋️',
        hire_cost: 10000,
        daily_wage: 1500,
        income_boost: 0.35,
        description: 'Creates fake documents and currency',
        criminal: true,
        business_types: ['counterfeit_shop', 'money_laundering']
    }
};

// Bodyguard types for personal protection
const BODYGUARD_TYPES = {
    basic_bodyguard: {
        name: 'Basic Bodyguard',
        emoji: '👨‍💼',
        hire_cost: 5000,
        daily_wage: 500,
        protection_level: 1,
        attack_reduction: 0.20,
        description: 'Basic personal protection'
    },
    professional_bodyguard: {
        name: 'Professional Bodyguard',
        emoji: '🕴️',
        hire_cost: 15000,
        daily_wage: 1000,
        protection_level: 2,
        attack_reduction: 0.40,
        description: 'Experienced security professional'
    },
    elite_bodyguard: {
        name: 'Elite Bodyguard',
        emoji: '🥷',
        hire_cost: 50000,
        daily_wage: 2000,
        protection_level: 3,
        attack_reduction: 0.60,
        description: 'Military-trained protection specialist'
    }
};

// Load business data
function loadBusinessData() {
    try {
        if (fs.existsSync(BUSINESS_DATA_FILE)) {
            return JSON.parse(fs.readFileSync(BUSINESS_DATA_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading business data:', error);
    }
    return {};
}

// Save business data
function saveBusinessData(data) {
    try {
        fs.writeFileSync(BUSINESS_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving business data:', error);
    }
}

// Get user business data
function getUserBusinessData(userId) {
    const data = loadBusinessData();
    return data[userId] || {
        businesses: {},
        employees: {},
        bodyguards: {},
        last_collection: 0,
        total_income: 0
    };
}

// Save user business data
function saveUserBusinessData(userId, businessData) {
    const data = loadBusinessData();
    data[userId] = businessData;
    saveBusinessData(data);
}

// Purchase a business
function purchaseBusiness(userId, businessType, businessName) {
    const business = BUSINESS_TYPES[businessType];
    if (!business) {
        return { success: false, reason: 'invalid_business' };
    }

    const userData = getUserBusinessData(userId);
    
    // Check if user already owns this type of business
    if (userData.businesses[businessType]) {
        return { success: false, reason: 'already_owned' };
    }

    const businessId = `${businessType}_${Date.now()}`;
    userData.businesses[businessType] = {
        id: businessId,
        name: businessName || business.name,
        type: businessType,
        purchased_at: Date.now(),
        employees: [],
        last_income_collection: Date.now(),
        total_earned: 0,
        times_robbed: 0
    };

    saveUserBusinessData(userId, userData);
    return { success: true, business, business_id: businessId };
}

// Hire an employee
function hireEmployee(userId, businessType, employeeType) {
    const business = BUSINESS_TYPES[businessType];
    const employee = EMPLOYEE_TYPES[employeeType];
    
    if (!business || !employee) {
        return { success: false, reason: 'invalid_type' };
    }

    const userData = getUserBusinessData(userId);
    
    if (!userData.businesses[businessType]) {
        return { success: false, reason: 'no_business' };
    }

    const userBusiness = userData.businesses[businessType];
    
    // Check employee limit
    if (userBusiness.employees.length >= business.max_employees) {
        return { success: false, reason: 'employee_limit' };
    }

    // Check if already have this type of employee
    const hasEmployeeType = userBusiness.employees.some(emp => emp.type === employeeType);
    if (hasEmployeeType) {
        return { success: false, reason: 'already_hired' };
    }

    const employeeId = `${employeeType}_${Date.now()}`;
    userBusiness.employees.push({
        id: employeeId,
        type: employeeType,
        hired_at: Date.now(),
        total_wages_paid: 0
    });

    saveUserBusinessData(userId, userData);
    return { success: true, employee, employee_id: employeeId };
}

// Hire a bodyguard
function hireBodyguard(userId, bodyguardType) {
    const bodyguard = BODYGUARD_TYPES[bodyguardType];
    if (!bodyguard) {
        return { success: false, reason: 'invalid_bodyguard' };
    }

    const userData = getUserBusinessData(userId);
    
    // Check if already have a bodyguard of this type
    if (userData.bodyguards[bodyguardType]) {
        return { success: false, reason: 'already_hired' };
    }

    const bodyguardId = `${bodyguardType}_${Date.now()}`;
    userData.bodyguards[bodyguardType] = {
        id: bodyguardId,
        type: bodyguardType,
        hired_at: Date.now(),
        total_wages_paid: 0
    };

    saveUserBusinessData(userId, userData);
    return { success: true, bodyguard, bodyguard_id: bodyguardId };
}

// Calculate total business income for all businesses
function calculateTotalBusinessIncome(userId) {
    const userData = getUserBusinessData(userId);
    let totalIncome = 0;
    
    Object.entries(userData.businesses).forEach(([businessId, business]) => {
        const businessInfo = BUSINESS_TYPES[business.type];
        if (!businessInfo) return;
        
        let businessIncome = businessInfo.base_income;
        
        // Apply employee bonuses
        userData.employees.forEach(employee => {
            const employeeInfo = EMPLOYEE_TYPES[employee.type];
            if (employeeInfo && employeeInfo.income_boost) {
                businessIncome *= (1 + employeeInfo.income_boost);
            }
        });
        
        // Subtract employee wages
        userData.employees.forEach(employee => {
            const employeeInfo = EMPLOYEE_TYPES[employee.type];
            if (employeeInfo) {
                businessIncome -= employeeInfo.wage;
            }
        });
        
        // Subtract bodyguard costs
        userData.bodyguards.forEach(bodyguard => {
            const bodyguardInfo = BODYGUARD_TYPES[bodyguard.type];
            if (bodyguardInfo) {
                businessIncome -= bodyguardInfo.wage;
            }
        });
        
        totalIncome += Math.max(0, businessIncome);
    });
    
    return totalIncome;
}

// Check if a business can be robbed (has no security)
function canRobBusiness(businessType) {
    // Get all business owners and check if any have security for this business type
    const fs = require('fs');
    const path = require('path');
    const dataFile = path.join(__dirname, '../../../data/business-data.json');
    
    try {
        const allBusinessData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        
        for (const [ownerId, businessData] of Object.entries(allBusinessData)) {
            // Check if this owner has the business type being robbed
            const hasThisBusiness = Object.values(businessData.businesses || {}).some(biz => biz.type === businessType);
            
            if (hasThisBusiness) {
                // Check if they have security employees
                const hasSecurityEmployees = (businessData.employees || []).some(emp => 
                    emp.type === 'security_guard' || emp.type === 'head_of_security'
                );
                
                if (hasSecurityEmployees) {
                    return { can_rob: false, owner_id: ownerId, has_security: true };
                }
            }
        }
    } catch (error) {
        // If file doesn't exist or error reading, allow robbery
    }
    
    return { can_rob: true, has_security: false };
}

// Calculate business income for specific business
function calculateBusinessIncome(userId, businessType) {
    const business = BUSINESS_TYPES[businessType];
    const userData = getUserBusinessData(userId);
    const userBusiness = userData.businesses[businessType];
    
    if (!business || !userBusiness) {
        return { success: false, reason: 'no_business' };
    }

    const now = Date.now();
    const timeSinceLastCollection = now - userBusiness.last_income_collection;
    const hoursElapsed = timeSinceLastCollection / (1000 * 60 * 60);
    
    // Calculate base income using random value within range
    const baseIncomePerHour = (business.daily_income.min + Math.random() * (business.daily_income.max - business.daily_income.min)) / 24;
    let grossIncome = baseIncomePerHour * hoursElapsed;
    
    // Store original gross income for raid calculations
    const originalGrossIncome = grossIncome;
    
    // Check for police raids on illegal businesses
    if (business.illegal && Math.random() < business.risk * 0.05) {
        // Check if bodyguards can fight off the police
        let bodyguardDefense = false;
        let defenseStory = '';
        let lossReduction = 0;
        let businessBodyguards = [];
        
        // Get bodyguards assigned to business protection
        const { getCrimeData } = require('./crime-manager');
        const crimeData = getCrimeData(userId);
        const userBodyguards = crimeData.bodyguards || {};
        
        Object.entries(userBodyguards).forEach(([type, data]) => {
            if (data.assignment === 'business') {
                const protection = getBusinessBodyguardInfo(type);
                if (protection) {
                    businessBodyguards.push({ type, count: data.count, ...protection });
                }
            }
        });
        
        if (businessBodyguards.length > 0) {
            const totalBodyguards = businessBodyguards.reduce((sum, bg) => sum + bg.count, 0);
            let totalDefense = 0;
            
            businessBodyguards.forEach(bg => {
                totalDefense += bg.attack_reduction * bg.count;
            });
            
            const defenseChance = Math.min(0.7, totalDefense); // Max 70% defense chance
            
            if (Math.random() < defenseChance) {
                bodyguardDefense = true;
                lossReduction = Math.min(0.8, totalDefense); // Max 80% loss reduction
                
                const bodyguardList = businessBodyguards.map(bg => 
                    `${bg.emoji} ${bg.name} x${bg.count}`
                ).join(', ');
                
                const defenseStories = [
                    `🔫 Your ${totalBodyguards} bodyguards (${bodyguardList}) engage in a fierce gunfight with the police! Bullets fly as they create a defensive perimeter around your operation.`,
                    `💥 Your security team opens fire on the raid squad! The ${bodyguardList} unleash hell with automatic weapons as muzzle flashes light up the darkness.`,
                    `🚨 "CONTACT! CONTACT!" Your ${bodyguardList} scream as they lay down suppressive fire. The police are forced to take cover behind their vehicles.`,
                    `⚡ Your enforcers spring into action! The ${bodyguardList} use military tactics, forcing the police to call for backup as the situation escalates.`,
                    `🔥 A full-scale firefight erupts! Your ${totalBodyguards} bodyguards (${bodyguardList}) overwhelm the raid team with superior firepower and training.`
                ];
                defenseStory = defenseStories[Math.floor(Math.random() * defenseStories.length)];
            } else {
                const bodyguardList = businessBodyguards.map(bg => 
                    `${bg.emoji} ${bg.name} x${bg.count}`
                ).join(', ');
                
                const failStories = [
                    `💀 Your ${totalBodyguards} bodyguards (${bodyguardList}) are overwhelmed by the tactical response team! Despite their resistance, they're outgunned and outmaneuvered.`,
                    `🚁 Police helicopters and SWAT teams surround your operation. Your ${bodyguardList} fight valiantly but are eventually subdued by superior numbers.`,
                    `⚰️ The raid was a setup! Your ${bodyguardList} walk into an ambush and are quickly neutralized by federal agents with superior firepower.`,
                    `🩸 Your security team (${bodyguardList}) puts up a fight but the police came prepared. One by one, your bodyguards fall to tactical superiority.`
                ];
                defenseStory = failStories[Math.floor(Math.random() * failStories.length)];
            }
        }
        
        try {
            const { arrestUser } = require('./crime-manager');
            const baseArrestTime = 30 + Math.random() * 60; // 30-90 minutes
            const arrestTime = bodyguardDefense ? baseArrestTime * 0.5 : baseArrestTime; // Reduced if defended
            const baseBail = Math.floor(grossIncome * 2);
            const bailAmount = bodyguardDefense ? Math.floor(baseBail * 0.6) : baseBail; // Lower bail if defended
            const actualLoss = bodyguardDefense ? Math.floor(grossIncome * (1 - lossReduction)) : grossIncome;
            
            if (!bodyguardDefense) {
                arrestUser(userId, arrestTime * 60 * 1000, 'Illegal Business Operation', bailAmount);
            }
            
            return {
                success: false,
                reason: 'raided',
                bodyguard_defense: bodyguardDefense,
                defense_story: defenseStory,
                arrest_time: bodyguardDefense ? 0 : Math.floor(arrestTime),
                bail_amount: bodyguardDefense ? 0 : bailAmount,
                lost_income: actualLoss,
                bodyguards_used: userBusiness.bodyguards ? userBusiness.bodyguards.length : 0
            };
        } catch (error) {
            // If crime manager not available, continue without raid
            console.log('Crime manager not available for business raids');
        }
    }
    
    // Apply employee bonuses to the specific business
    let incomeMultiplier = 1.0;
    let riskReduction = 0;
    userBusiness.employees.forEach(emp => {
        const employeeInfo = EMPLOYEE_TYPES[emp.type];
        if (employeeInfo) {
            if (employeeInfo.income_boost) {
                incomeMultiplier += employeeInfo.income_boost;
            }
            if (employeeInfo.risk_reduction && business.illegal) {
                riskReduction += employeeInfo.risk_reduction;
            }
        }
    });
    
    // Apply risk reduction for illegal businesses
    if (business.illegal) {
        const finalRisk = Math.max(0.01, business.risk * (1 - riskReduction));
        // Risk reduction affects raid chance but doesn't eliminate it completely
    }
    
    grossIncome *= incomeMultiplier;
    
    // Calculate employee wages for this business
    let employeeWages = 0;
    userBusiness.employees.forEach(emp => {
        const employeeInfo = EMPLOYEE_TYPES[emp.type];
        if (employeeInfo) {
            employeeWages += (employeeInfo.daily_wage / 24) * hoursElapsed;
        }
    });
    
    // Calculate bodyguard wages (shared across all businesses)
    let bodyguardWages = 0;
    Object.values(userData.bodyguards).forEach(bodyguard => {
        const bodyguardInfo = BODYGUARD_TYPES[bodyguard.type];
        if (bodyguardInfo) {
            bodyguardWages += (bodyguardInfo.daily_wage / 24) * hoursElapsed;
        }
    });
    
    const netIncome = Math.max(0, grossIncome - employeeWages - bodyguardWages);
    
    return {
        success: true,
        gross_income: Math.floor(grossIncome),
        employee_wages: Math.floor(employeeWages),
        bodyguard_wages: Math.floor(bodyguardWages),
        net_income: Math.floor(netIncome),
        hours_elapsed: Math.floor(hoursElapsed * 10) / 10
    };
}

// Collect business income
function collectBusinessIncome(userId, businessType) {
    const incomeResult = calculateBusinessIncome(userId, businessType);
    if (!incomeResult.success) {
        return incomeResult;
    }

    const userData = getUserBusinessData(userId);
    const userBusiness = userData.businesses[businessType];
    
    // Update collection time
    userBusiness.last_income_collection = Date.now();
    userBusiness.total_earned += incomeResult.net_income;
    userData.total_income += incomeResult.net_income;
    
    // Update employee wage totals
    userBusiness.employees.forEach(emp => {
        const employeeType = EMPLOYEE_TYPES[emp.type];
        emp.total_wages_paid += (employeeType.daily_wage / 24) * incomeResult.hours_elapsed;
    });
    
    // Update bodyguard wage totals
    Object.values(userData.bodyguards).forEach(bodyguard => {
        const bodyguardType = BODYGUARD_TYPES[bodyguard.type];
        bodyguard.total_wages_paid += (bodyguardType.daily_wage / 24) * incomeResult.hours_elapsed;
    });
    
    saveUserBusinessData(userId, userData);
    return incomeResult;
}

// Check if business can be robbed (has protection)
function getBusinessProtection(userId, businessType) {
    const userData = getUserBusinessData(userId);
    const userBusiness = userData.businesses[businessType];
    
    if (!userBusiness) {
        return { protected: false, protection_level: 0 };
    }

    let robberyProtection = 0;
    let securityEmployees = 0;
    
    // Check for security employees
    userBusiness.employees.forEach(emp => {
        const employeeType = EMPLOYEE_TYPES[emp.type];
        if (employeeType.robbery_protection) {
            robberyProtection += employeeType.robbery_protection;
            securityEmployees++;
        }
    });

    return {
        protected: robberyProtection > 0,
        protection_level: robberyProtection,
        security_employees: securityEmployees
    };
}

// Get bodyguard protection for a user
function getBodyguardProtection(userId) {
    const businessData = getUserBusinessData(userId);
    const bodyguards = businessData.bodyguards || [];
    
    if (bodyguards.length === 0) {
        return { protected: false, protection_level: 0, bodyguard_count: 0 };
    }
    
    // Calculate total protection level
    let totalProtection = 0;
    bodyguards.forEach(bodyguard => {
        const bodyguardInfo = BODYGUARD_TYPES[bodyguard.type];
        if (bodyguardInfo) {
            totalProtection += bodyguardInfo.protection_level;
        }
    });
    
    // Cap protection at 80%
    const finalProtection = Math.min(0.8, totalProtection);
    
    return {
        protected: true,
        protection_level: finalProtection,
        bodyguard_count: bodyguards.length,
        bodyguards: bodyguards
    };
}

// Check if user's business has security employees
function hasBusinessSecurity(userId) {
    const businessData = getUserBusinessData(userId);
    const employees = businessData.employees || [];
    
    const securityEmployees = employees.filter(emp => 
        emp.type === 'security_guard' || emp.type === 'head_of_security'
    );
    
    return {
        has_security: securityEmployees.length > 0,
        security_count: securityEmployees.length,
        security_employees: securityEmployees
    };
}

// Format business display
function formatBusinessDisplay(userId) {
    const userData = getUserBusinessData(userId);
    
    if (Object.keys(userData.businesses).length === 0) {
        return 'You don\'t own any businesses yet! Use `%business buy` to start your empire.';
    }
    
    let display = '**🏢 Your Business Empire:**\n\n';
    
    Object.entries(userData.businesses).forEach(([businessType, business]) => {
        const businessInfo = BUSINESS_TYPES[businessType];
        const incomeResult = calculateBusinessIncome(userId, businessType);
        
        display += `${businessInfo.emoji} **${business.name}**\n`;
        display += `└ 💰 Pending Income: ${incomeResult.net_income?.toLocaleString() || 0} coins\n`;
        display += `└ 👥 Employees: ${business.employees.length}/${businessInfo.max_employees}\n`;
        display += `└ 📈 Total Earned: ${business.total_earned.toLocaleString()} coins\n`;
        display += `└ \`%business collect ${businessType}\`\n\n`;
    });
    
    // Show bodyguards
    if (Object.keys(userData.bodyguards).length > 0) {
        display += '**🛡️ Your Bodyguards:**\n';
        Object.values(userData.bodyguards).forEach(bodyguard => {
            const bodyguardInfo = BODYGUARD_TYPES[bodyguard.type];
            display += `${bodyguardInfo.emoji} ${bodyguardInfo.name}\n`;
        });
        display += '\n';
    }
    
    display += `**💼 Total Business Income:** ${userData.total_income.toLocaleString()} coins`;
    
    return display;
}

function getBusinessBodyguardInfo(type) {
    const bodyguardTypes = {
        basic_bodyguard: {
            name: 'Basic Bodyguard',
            emoji: '👨‍💼',
            attack_reduction: 0.20
        },
        professional_bodyguard: {
            name: 'Professional Bodyguard',
            emoji: '🕴️',
            attack_reduction: 0.40
        },
        elite_bodyguard: {
            name: 'Elite Bodyguard',
            emoji: '🥷',
            attack_reduction: 0.60
        }
    };
    
    return bodyguardTypes[type];
}

module.exports = {
    BUSINESS_TYPES,
    EMPLOYEE_TYPES,
    BODYGUARD_TYPES,
    getUserBusinessData,
    saveUserBusinessData,
    purchaseBusiness,
    hireEmployee,
    hireBodyguard,
    collectBusinessIncome,
    calculateTotalBusinessIncome,
    calculateBusinessIncome,
    getBusinessProtection,
    getBodyguardProtection,
    hasBusinessSecurity,
    canRobBusiness,
    formatBusinessDisplay
};
