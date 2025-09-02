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
function calculateSpecificBusinessIncome(userId, businessType) {
    const business = BUSINESS_TYPES[businessType];
    const userData = getUserBusinessData(userId);
    const userBusiness = userData.businesses[businessType];
    
    if (!business || !userBusiness) {
        return { success: false, reason: 'no_business' };
    }

    const now = Date.now();
    const timeSinceLastCollection = now - userBusiness.last_income_collection;
    const hoursElapsed = timeSinceLastCollection / (1000 * 60 * 60);
    
    // Calculate base income
    let netIncome = business.base_income * hoursElapsed;
    
    // Apply employee bonuses
    userData.employees.forEach(employee => {
        const employeeInfo = EMPLOYEE_TYPES[employee.type];
        if (employeeInfo && employeeInfo.income_boost) {
            netIncome *= (1 + employeeInfo.income_boost);
        }
    });
    
    // Subtract employee wages
    userData.employees.forEach(employee => {
        const employeeInfo = EMPLOYEE_TYPES[employee.type];
        if (employeeInfo) {
            netIncome -= employeeInfo.wage * hoursElapsed;
        }
    });
    
    // Subtract bodyguard costs
    userData.bodyguards.forEach(bodyguard => {
        const bodyguardInfo = BODYGUARD_TYPES[bodyguard.type];
        if (bodyguardInfo) {
            netIncome -= bodyguardInfo.wage * hoursElapsed;
        }
    });
    
    return {
        success: true,
        net_income: Math.floor(Math.max(0, netIncome)),
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

module.exports = {
    BUSINESS_TYPES,
    EMPLOYEE_TYPES,
    BODYGUARD_TYPES,
    getUserBusinessData,
    saveUserBusinessData,
    buyBusiness,
    hireEmployee,
    hireBodyguard,
    collectIncome,
    calculateTotalBusinessIncome,
    calculateSpecificBusinessIncome,
    getBusinessProtection,
    getBodyguardProtection,
    hasBusinessSecurity,
    canRobBusiness,
    formatBusinessDisplay
};
