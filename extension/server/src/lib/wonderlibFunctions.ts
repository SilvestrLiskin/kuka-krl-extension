/**
 * Wonderlibrary Functions
 * Static definitions for kuka_krl_wonderlibrary functions
 * Source: https://github.com/skilledAutomation/kuka_krl_wonderlibrary
 */

export interface WonderlibFunction {
    name: string;
    params: string;
    returnType: string;
    description: string;
    module: 'files' | 'geometry' | 'logical' | 'math' | 'string';
}

export const WONDERLIB_FUNCTIONS: WonderlibFunction[] = [
    // ===== FILES MODULE =====
    {
        name: 'fopen',
        params: 'FILENAME:IN, MODE:IN, HANDLE:OUT',
        returnType: 'BOOL',
        description: 'Open file for reading/writing. MODE: "r"=read, "w"=write, "a"=append. Returns TRUE on success.',
        module: 'files',
    },
    {
        name: 'fclose',
        params: 'HANDLE:IN',
        returnType: 'BOOL',
        description: 'Close file by handle. Returns TRUE on success.',
        module: 'files',
    },
    {
        name: 'fclose_all',
        params: 'INTERPRETER:IN',
        returnType: 'BOOL',
        description: 'Close all files. INTERPRETER: 0=submit, 1=robot, -1=current, -99=all.',
        module: 'files',
    },
    {
        name: 'feof',
        params: 'HANDLE:IN, bEOF:OUT',
        returnType: 'BOOL',
        description: 'Check if end of file reached. bEOF is set to TRUE at EOF.',
        module: 'files',
    },
    {
        name: 'fgetc',
        params: 'HANDLE:IN, character:OUT',
        returnType: 'BOOL',
        description: 'Read single character from file.',
        module: 'files',
    },
    {
        name: 'fgets',
        params: 'HANDLE:IN, buffer:OUT, bufferSize:IN, readCharNum:OUT, SEPARATOR:IN',
        returnType: 'BOOL',
        description: 'Read line from file up to separator or newline.',
        module: 'files',
    },
    {
        name: 'fscanf_int',
        params: 'HANDLE:IN, SEPARATOR:IN, VAR:OUT',
        returnType: 'BOOL',
        description: 'Read integer from file terminated by SEPARATOR.',
        module: 'files',
    },
    {
        name: 'fscanf_real',
        params: 'HANDLE:IN, SEPARATOR:IN, VAR:OUT',
        returnType: 'BOOL',
        description: 'Read floating point number from file terminated by SEPARATOR.',
        module: 'files',
    },
    {
        name: 'fprint',
        params: 'HANDLE:IN, STRING:IN',
        returnType: 'BOOL',
        description: 'Write string to file (without newline).',
        module: 'files',
    },
    {
        name: 'fprintf',
        params: 'HANDLE:IN, STRING:IN',
        returnType: 'BOOL',
        description: 'Write string to file with newline (CR+LF).',
        module: 'files',
    },
    {
        name: 'LOG',
        params: 'STRINGA:IN',
        returnType: 'VOID',
        description: 'Log message to file in C:/KRC/ROBOTER/UserFiles/.',
        module: 'files',
    },
    {
        name: 'LOGERROR',
        params: 'STRINGA:IN',
        returnType: 'VOID',
        description: 'Log error message (requires fileslib_LOG_LEVEL >= LOG_ERROR).',
        module: 'files',
    },
    {
        name: 'LOGDEBUG',
        params: 'STRINGA:IN',
        returnType: 'VOID',
        description: 'Log debug message (requires fileslib_LOG_LEVEL >= LOG_DEBUG).',
        module: 'files',
    },

    // ===== GEOMETRY MODULE =====
    {
        name: 'DISTANCE_POINT_POINT',
        params: 'p1:IN, p2:IN',
        returnType: 'REAL',
        description: 'Calculate 3D Euclidean distance between two E6POS points.',
        module: 'geometry',
    },
    {
        name: 'LINE2D_FROM_2P',
        params: 'p1:IN, p2:IN',
        returnType: 'STR_LINE2D',
        description: 'Create 2D line from two points. Line equation: ax + by + c = 0.',
        module: 'geometry',
    },
    {
        name: 'LINE2D_FROM_ABC',
        params: 'a:IN, b:IN, c:IN',
        returnType: 'STR_LINE2D',
        description: 'Create 2D line from coefficients (ax + by + c = 0).',
        module: 'geometry',
    },
    {
        name: 'LINE2D_DIST_FROM_POINT',
        params: 'line:IN, p:IN',
        returnType: 'REAL',
        description: 'Calculate distance from point to 2D line.',
        module: 'geometry',
    },
    {
        name: 'LINE2D_Y_GIVEN_X',
        params: 'line:IN, x:IN',
        returnType: 'REAL',
        description: 'Calculate Y coordinate on line given X.',
        module: 'geometry',
    },
    {
        name: 'LINE2D_X_GIVEN_Y',
        params: 'line:IN, y:IN',
        returnType: 'REAL',
        description: 'Calculate X coordinate on line given Y.',
        module: 'geometry',
    },
    {
        name: 'LINE2D_INTERSECTION',
        params: 'line1:IN, line2:IN',
        returnType: 'E6POS',
        description: 'Find intersection point of two 2D lines.',
        module: 'geometry',
    },
    {
        name: 'CIRC_FROM_CENTER_RADIUS',
        params: 'center:IN, radius:IN',
        returnType: 'STR_CIRCUMFERENCE2D',
        description: 'Create 2D circle from center point and radius.',
        module: 'geometry',
    },
    {
        name: 'CIRC_FROM_3POINTS',
        params: 'p1:IN, p2:IN, p3:IN, error:OUT',
        returnType: 'STR_CIRCUMFERENCE2D',
        description: 'Create 2D circle passing through 3 points. error=TRUE on failure.',
        module: 'geometry',
    },
    {
        name: 'CIRCUMFERENCE_CENTER',
        params: 'circumference:IN',
        returnType: 'E6POS',
        description: 'Get center point of circumference.',
        module: 'geometry',
    },
    {
        name: 'CIRCUMFERENCE_RADIUS',
        params: 'circumference:IN',
        returnType: 'REAL',
        description: 'Get radius of circumference.',
        module: 'geometry',
    },
    {
        name: 'LINE2D_CIRC_INTERSECTION',
        params: 'line:IN, circumference:IN, intersectionPoint1:OUT, intersectionPoint2:OUT',
        returnType: 'INT',
        description: 'Find intersection of line and circle. Returns number of intersections (0, 1, or 2).',
        module: 'geometry',
    },
    {
        name: 'RADICAL_AXIS',
        params: 'c1:IN, c2:IN',
        returnType: 'STR_LINE2D',
        description: 'Calculate radical axis of two circumferences.',
        module: 'geometry',
    },
    {
        name: 'PLANE_FROM_3p',
        params: 'p1:IN, p2:IN, p3:IN',
        returnType: 'STR_PLANE',
        description: 'Create 3D plane from 3 points. Plane equation: ax + by + cz + d = 0.',
        module: 'geometry',
    },
    {
        name: 'PLANE_X_GivenYZ',
        params: 'plane:IN, y:IN, z:IN',
        returnType: 'REAL',
        description: 'Calculate X coordinate on plane given Y and Z.',
        module: 'geometry',
    },
    {
        name: 'PLANE_Y_GivenXZ',
        params: 'plane:IN, x:IN, z:IN',
        returnType: 'REAL',
        description: 'Calculate Y coordinate on plane given X and Z.',
        module: 'geometry',
    },
    {
        name: 'PLANE_Z_GivenXY',
        params: 'plane:IN, x:IN, y:IN',
        returnType: 'REAL',
        description: 'Calculate Z coordinate on plane given X and Y.',
        module: 'geometry',
    },
    {
        name: 'PLANE_DIST_TO_POINT',
        params: 'plane:IN, p:IN',
        returnType: 'REAL',
        description: 'Calculate distance from point to 3D plane.',
        module: 'geometry',
    },
    {
        name: 'LINE3D_FROM_PLANES',
        params: 'plane1:IN, plane2:IN',
        returnType: 'STR_LINE3D',
        description: 'Create 3D line from intersection of two planes.',
        module: 'geometry',
    },
    {
        name: 'LINE3D_FROM_PARAMETRIC',
        params: 'point:IN, vec:IN',
        returnType: 'STR_LINE3D',
        description: 'Create 3D line from point and direction vector.',
        module: 'geometry',
    },
    {
        name: 'LINE3D_POINT_FROM_ORIGIN',
        params: 'line3d:IN, distance:IN',
        returnType: 'E6POS',
        description: 'Get point on 3D line at specified distance from origin.',
        module: 'geometry',
    },
    {
        name: 'LINE3D_TO_POLAR_COORD',
        params: 'line3d:IN, radius:OUT, polar_angle:OUT, azimut:OUT',
        returnType: 'VOID',
        description: 'Convert 3D line to spherical polar coordinates (degrees).',
        module: 'geometry',
    },
    {
        name: 'VECTOR3D_DIRECTOR_COSINE',
        params: 'vec:IN',
        returnType: 'STR_VECTOR3D',
        description: 'Calculate direction cosines of 3D vector.',
        module: 'geometry',
    },

    // ===== LOGICAL MODULE =====
    {
        name: 'BOOL_CHOOSEI',
        params: 'CONDITION:IN, TRUEVALUE:IN, FALSEVALUE:IN',
        returnType: 'INT',
        description: 'Ternary operator for INT: returns TRUEVALUE if CONDITION, else FALSEVALUE.',
        module: 'logical',
    },
    {
        name: 'BOOL_CHOOSEF',
        params: 'CONDITION:IN, TRUEVALUE:IN, FALSEVALUE:IN',
        returnType: 'REAL',
        description: 'Ternary operator for REAL: returns TRUEVALUE if CONDITION, else FALSEVALUE.',
        module: 'logical',
    },
    {
        name: 'BOOL_CHOOSE_E6POS',
        params: 'CONDITION:IN, TRUEVALUE:IN, FALSEVALUE:IN',
        returnType: 'E6POS',
        description: 'Ternary operator for E6POS: returns TRUEVALUE if CONDITION, else FALSEVALUE.',
        module: 'logical',
    },
    {
        name: 'BOOL_CHOOSESTR',
        params: 'CONDITION:IN, TRUEVALUE:IN, FALSEVALUE:IN',
        returnType: 'CHAR[256]',
        description: 'Ternary operator for strings: returns TRUEVALUE if CONDITION, else FALSEVALUE.',
        module: 'logical',
    },
    {
        name: 'INT_CHOOSEF',
        params: 'CONDITION:IN, DEFAULTVALUE:IN, CASE0-9:IN',
        returnType: 'REAL',
        description: 'Select REAL value by integer index (0-9), returns DEFAULTVALUE if out of range.',
        module: 'logical',
    },

    // ===== MATH MODULE =====
    {
        name: 'IN_RANGE',
        params: 'value:IN, value_min:IN, value_max:IN',
        returnType: 'BOOL',
        description: 'Check if value is within range [min, max] (inclusive).',
        module: 'math',
    },
    {
        name: 'IN_TOLERANCE',
        params: 'value:IN, value_ref:IN, tolerance:IN',
        returnType: 'BOOL',
        description: 'Check if value is near reference within tolerance.',
        module: 'math',
    },

    // ===== STRING MODULE =====
    {
        name: 'STOF',
        params: 'STRING:IN',
        returnType: 'REAL',
        description: 'Convert string to REAL (floating point).',
        module: 'string',
    },
    {
        name: 'STOI',
        params: 'STRING:IN',
        returnType: 'INT',
        description: 'Convert string to INT (integer).',
        module: 'string',
    },
    {
        name: 'FTOS',
        params: 'VALUE:IN',
        returnType: 'CHAR[128]',
        description: 'Convert REAL to string.',
        module: 'string',
    },
    {
        name: 'ITOS',
        params: 'VALUE:IN',
        returnType: 'CHAR[128]',
        description: 'Convert INT to string.',
        module: 'string',
    },
    {
        name: 'BTOS',
        params: 'VALUE:IN',
        returnType: 'CHAR[128]',
        description: 'Convert BOOL to string.',
        module: 'string',
    },
    {
        name: 'PTOS',
        params: 'POINT:IN',
        returnType: 'CHAR[256]',
        description: 'Convert E6POS to formatted string "{X ..., Y ..., Z ..., A ..., B ..., C ...}".',
        module: 'string',
    },
    {
        name: 'MID',
        params: 'STRING:IN, OFFSET:IN, LENGTH:IN, OUTPUT_STRING:OUT',
        returnType: 'VOID',
        description: 'Extract substring from STRING starting at OFFSET with given LENGTH.',
        module: 'string',
    },
    {
        name: 'SPRINTF',
        params: 'FORMAT:IN, PARAM1-7:IN',
        returnType: 'CHAR[256]',
        description: 'Format string like printf. Supports %s, %d, %f. Up to 7 parameters.',
        module: 'string',
    },
];
