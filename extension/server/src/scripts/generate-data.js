const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const dataDir = path.join(__dirname, '../data');
const output = path.join(dataDir, 'krl-ref.json');

const files = {
    systemVariables: 'System.Variables.yml',
    types: 'System.Types.yml',
    functions: 'System.Functions.yml',
    messages: 'System.Messages.yml'
};

const result = {
    systemVariables: {},
    types: {},
    functions: {},
    messages: {},
    commands: {} // Will populate manually or if we find the file
};

// 1. Process System Variables
try {
    const file = fs.readFileSync(path.join(dataDir, files.systemVariables), 'utf8');
    const parsed = YAML.parse(file);
    // Usually a list
    if (Array.isArray(parsed)) {
        parsed.forEach(item => {
            if (item.name) {
                // Remove $ prefix for key if desired, but keeping it is safer for lookup
                result.systemVariables[item.name] = item;
            }
        });
    }
} catch (e) {
    console.error("Error processing Variables:", e.message);
}

// 2. Process Types
try {
    const file = fs.readFileSync(path.join(dataDir, files.types), 'utf8');
    const parsed = YAML.parse(file);
    // Structure: types: [ ... ]
    if (parsed && Array.isArray(parsed.types)) {
        parsed.types.forEach(item => {
            if (item.name) {
                result.types[item.name] = item;
            }
        });
    } else if (Array.isArray(parsed)) { // Fallback if root is array
        parsed.forEach(item => {
            if (item.name) {
                result.types[item.name] = item;
            }
        });
    }
} catch (e) {
    console.error("Error processing Types:", e.message);
}

// 3. Process Functions
try {
    const file = fs.readFileSync(path.join(dataDir, files.functions), 'utf8');
    const parsed = YAML.parse(file);
    if (parsed && Array.isArray(parsed.functions)) {
        parsed.functions.forEach(item => {
            if (item.name) {
                result.functions[item.name] = item;
            }
        });
    }
} catch (e) {
    console.error("Error processing Functions:", e.message);
}

// 4. Manual Commands & Keywords
// We manually define standard language keywords that are missing from the available YAMLs
const manualCommands = [
    // Motion
    { name: "PTP", description: "Point-to-Point motion. Moves the robot to a point using the fastest path.", syntax: "PTP {Point} [C_PTP] [C_DIS]" },
    { name: "LIN", description: "Linear motion. Moves the robot in a straight line to the target point.", syntax: "LIN {Point} [C_DIS] [C_VEL]" },
    { name: "CIRC", description: "Circular motion. Moves along a circular path via an auxiliary point.", syntax: "CIRC {AuxPoint}, {TargetPoint} [C_DIS]" },
    { name: "SPTP", description: "Spline PTP motion. Smoother, more precise PTP motion (KSS 8.3+).", syntax: "SPTP {Point} [WITH ...]" },
    { name: "SLIN", description: "Spline Linear motion. Smoother, more precise Linear motion (KSS 8.3+).", syntax: "SLIN {Point} [WITH ...]" },
    { name: "SCIRC", description: "Spline Circular motion.", syntax: "SCIRC {AuxPoint}, {TargetPoint} [WITH ...]" },
    { name: "BRAKE", description: "Stops the robot motion immediately (ramp-down braking). Often used in Interrupts." },
    { name: "HALT", description: "Stops the program execution. Requires Start key to resume." },

    // Control Flow
    { name: "IF", description: "Conditional branching. Executes a block if the condition is TRUE.", syntax: "IF {Condition} THEN\n  {Statements}\n[ELSE]\n  {Statements}\nENDIF" },
    { name: "THEN", description: "Start of the IF block execution branch." },
    { name: "ELSE", description: "Alternative branch in an IF block." },
    { name: "ENDIF", description: "End of an IF block." },

    { name: "FOR", description: "Loop with a counter variable.", syntax: "FOR {Var} = {Start} TO {End} [STEP {Incr}]\n  {Statements}\nENDFOR" },
    { name: "TO", description: "Defines the end value in a FOR loop." },
    { name: "STEP", description: "Defines the increment step in a FOR loop (default 1)." },
    { name: "ENDFOR", description: "End of a FOR loop." },

    { name: "WHILE", description: "Loop that repeats as long as the condition is TRUE.", syntax: "WHILE {Condition}\n  {Statements}\nENDWHILE" },
    { name: "ENDWHILE", description: "End of a WHILE loop." },

    { name: "LOOP", description: "Infinite loop. Must be exited with EXIT or GOTO.", syntax: "LOOP\n  {Statements}\nENDLOOP" },
    { name: "ENDLOOP", description: "End of a LOOP block." },

    { name: "REPEAT", description: "Loop that executes at least once and repeats until condition is TRUE.", syntax: "REPEAT\n  {Statements}\nUNTIL {Condition}" },
    { name: "UNTIL", description: "Condition check for REPEAT loop." },

    { name: "SWITCH", description: "Selects a block based on the value of a variable.", syntax: "SWITCH {Variable}\n  CASE {Value}\n    {Statements}\n  [DEFAULT]\n    {Statements}\nENDSWITCH" },
    { name: "CASE", description: "Defines a value branch in a SWITCH block." },
    { name: "DEFAULT", description: "Default branch in a SWITCH block if no CASE matches." },
    { name: "ENDSWITCH", description: "End of a SWITCH block." },

    { name: "GOTO", description: "Jumps to a defined Label.", syntax: "GOTO {LabelName}" },
    { name: "EXIT", description: "Exits a loop (FOR, WHILE, LOOP, REPEAT) prematurely." },

    // Declarations & Types
    { name: "DECL", description: "Declares a variable, array, or structure.", syntax: "DECL {Type} {Name}[{ArraySize}]" },
    { name: "GLOBAL", description: "Scope modifier: Makes the variable or subprogram accessible from other files." },
    { name: "PUBLIC", description: "Scope modifier: Makes the data list (DEFDAT) accessible." },
    { name: "CONST", description: "Declares a constant value. Must be initialized at declaration.", syntax: "DECL CONST {Type} {Name} = {Value}" },

    { name: "INT", description: "Integer data type (32-bit signed). Range: -2^31 to 2^31-1." },
    { name: "REAL", description: "Floating point number (32-bit). Approx 7 digits precision." },
    { name: "BOOL", description: "Boolean data type. Values: TRUE, FALSE." },
    { name: "CHAR", description: "Character data type. Also used for Strings (Array of CHAR)." },
    { name: "FRAME", description: "Geometric structure (X, Y, Z, A, B, C)." },
    { name: "POS", description: "Position structure (X, Y, Z, A, B, C, S, T)." },
    { name: "E6POS", description: "Extended Position structure (POS + E1-E6)." },
    { name: "E6AXIS", description: "Extended Axis structure (A1-A6 + E1-E6)." },

    { name: "STRUC", description: "Defines a custom structure type.", syntax: "STRUC {TypeName} {Field1}, {Field2}, ..." },
    { name: "ENUM", description: "Defines an enumeration type.", syntax: "ENUM {TypeName} {Value1}, {Value2}, ..." },

    // Structure Definition
    { name: "DEF", description: "Start of a subprogram definition.", syntax: "DEF {Name}({Params})" },
    { name: "DEFFCT", description: "Start of a function definition. Must return a value.", syntax: "DEFFCT {Type} {Name}({Params})" },
    { name: "DEFDAT", description: "Start of a data list definition.", syntax: "DEFDAT {Name} [PUBLIC]" },
    { name: "END", description: "End of a program (DEF) or data list (DEFDAT)." },
    { name: "ENDFCT", description: "End of a function (DEFFCT)." },
    { name: "ENDDAT", description: "End of a data list (DEFDAT)." },
    { name: "RETURN", description: "Returns from a function, optionally with a value.", syntax: "RETURN [{Value}]" },

    // System Functions & Logic
    { name: "WAIT", description: "Waits for a specific time or condition.", syntax: "WAIT SEC {Seconds}\nor\nWAIT FOR {Condition}" },
    { name: "CONTINUE", description: "Prevents the advance run pointer from stopping at the next instruction. Use before I/O or logic." },
    { name: "TRIGGER", description: "Path-triggered logic. Executes a statement at a specific point on the path.", syntax: "TRIGGER WHEN DISTANCE={Dist} DELAY={Time} DO {Statement}" },
    { name: "INTERRUPT", description: "Defines an interrupt service routine.", syntax: "INTERRUPT DECL {Priority} WHEN {Condition} DO {Subprogram}" },
    { name: "BRAKE", description: "Stops robot motion inside an Interrupt." },
    { name: "RESUME", description: "Aborts the current motion and stack, resuming execution at the level where the interrupt was declared." },

    { name: "SIGNAL", description: "Defines a name for an I/O signal or group of signals.", syntax: "SIGNAL {Name} $IN[{Number}]  TO $IN[{End}]" },
    { name: "ANIN", description: "Start analog input reading.", syntax: "ANIN ON {Variable} = {SignalFactor} * {SignalName} + {Offset}" },
    { name: "ANOUT", description: "Set analog output.", syntax: "ANOUT ON {SignalName} = {Factor} * {ControlVar} + {Offset}" },
    { name: "PULSE", description: "Sets an output for a specific duration.", syntax: "PULSE({Output}, {State}, {Duration})" },

    // Preprocessor Directives
    { name: "&ACCESS", description: "Defines access rights for the file.", syntax: "&ACCESS {RVO|RVP}" },
    { name: "&REL", description: "Defines usage of global symbols/variables.", syntax: "&REL {Number}" },
    { name: "&PARAM", description: "Defines file parameters (Template, Diskpath, etc.).", syntax: "&PARAM {Key} = {Value}" },
    { name: "&COMMENT", description: "Header comment for the file." },

    // System Functions & Helpers
    { name: "BAS", description: "Basis Technical package initialization and parameter setting.", syntax: "BAS ({Command}, {Value})" },
    { name: "SET_CD_PARAMS", description: "Sets collision detection parameters.", syntax: "SET_CD_PARAMS ({Index})" },

    // Spline Helpers (KSS 8.3+)
    { name: "SVEL_JOINT", description: "Spline velocity for joint movements.", syntax: "SVEL_JOINT({Value})" },
    { name: "STOOL2", description: "Spline tool definition.", syntax: "STOOL2({Frame})" },
    { name: "SBASE", description: "Spline base definition.", syntax: "SBASE({BaseNo})" },
    { name: "SIPO_MODE", description: "Spline interpolation mode.", syntax: "SIPO_MODE({Mode})" },
    { name: "SLOAD", description: "Spline load data.", syntax: "SLOAD({ToolNo})" },
    { name: "SACC_JOINT", description: "Spline acceleration for joint movements.", syntax: "SACC_JOINT({Value})" },
    { name: "SAPO_PTP", description: "Spline approximation for PTP.", syntax: "SAPO_PTP({Value})" },
    { name: "SGEAR_JERK", description: "Spline jerk setting.", syntax: "SGEAR_JERK({Value})" },
    { name: "USE_CM_PRO_VALUES", description: "Collision monitoring profile values.", syntax: "USE_CM_PRO_VALUES({Value})" },

    // Common System Variables (Manual additions)
    { name: "$STOPMESS", description: "System variable indicating a stop message is active (Boolean)." },
    { name: "$BWDSTART", description: "Flag to indicate backward motion start." },
    { name: "PDAT_ACT", description: "Active PTP point data structure (Velocity, Accel, Approx)." },
    { name: "FDAT_ACT", description: "Active Frame data structure (Tool, Base, IPO)." },
    { name: "LDAT_ACT", description: "Active LIN/CIRC dat structure (Vel, Acc, Approx)." }
];

manualCommands.forEach(cmd => {
    result.commands[cmd.name] = cmd;
});

fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log("krl-ref.json generated successfully!");
