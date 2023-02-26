var OPTAB = {
    'ADD': {code: 0x18, format: 3},
    'CLEAR': {code: 0xB4, format: 2},
    'COMP': {code: 0x28, format: 3},
    'COMPR': {code: 0xA0, format: 2},
    'J': {code: 0x3C, format: 3},
    'JEQ': {code: 0x30, format: 3},
    'JLT': {code: 0x38, format: 3},
    'JSUB': {code: 0x48, format: 3},
    'LDA': {code: 0x00, format: 3},
    'LDB': {code: 0x68, format: 3},
    'LDCH': {code: 0x50, format: 3},
    'LDL': {code: 0x08, format: 3},
    'LDT': {code: 0x74, format: 3},
    'LDX': {code: 0x04, format: 3},
    'RD': {code: 0xD8, format: 3},
    'RSUB': {code: 0x4C, format: 3},
    'STA': {code: 0x0C, format: 3},
    'STCH': {code: 0x54, format: 3},
    'STL': {code: 0x14, format: 3},
    'STX': {code: 0x10, format: 3},
    'TD': {code: 0xE0, format: 3},
    'TIX': {code: 0x2C, format: 3},
    'TIXR': {code: 0xB8, format: 2},
    'WD': {code: 0xDC, format: 3},
};

var SYMTAB;
var starting_address;
var program_length;
var program_counters = [];
var program_counter;
var base;
var Mrecord = [];
var default_source = `COPY	START	0
FIRST	STL	RETADR
	LDB	#LENGTH
	BASE	LENGTH
CLOOP	+JSUB	RDREC
	LDA	LENGTH
	COMP	#0
	JEQ	ENDFIL
	+JSUB	WRREC
	J	CLOOP
ENDFIL	LDA	EOF
	STA	BUFFER
	LDA	#3
	STA	LENGTH
	+JSUB	WRREC
	J	@RETADR
EOF	BYTE	C'EOF'
RETADR	RESW	1
LENGTH	RESW	1
BUFFER	RESB	4096
RDREC	CLEAR	X
	CLEAR	A
	CLEAR	S
	+LDT	#4096
RLOOP	TD	INPUT
	JEQ	RLOOP
	RD	INPUT
	COMPR	A,S
	JEQ	EXIT
	STCH	BUFFER,X
	TIXR	T
	JLT	RLOOP
EXIT	STX	LENGTH
	RSUB
INPUT	BYTE	X'F1'
WRREC	CLEAR	X
	LDT	LENGTH
WLOOP	TD	OUTPUT
	JEQ	WLOOP
	LDCH	BUFFER,X
	WD	OUTPUT
	TIXR	T
	JLT	WLOOP
	RSUB
OUTPUT	BYTE	X'05'
	END	FIRST`;

var uploadButton = document.createElement('input');
uploadButton.type = 'file';
uploadButton.id = 'uploadButton';
uploadButton.style.position = 'absolute';
uploadButton.style.left = '80px';
uploadButton.style.top = '580px';
document.body.appendChild(uploadButton);

var fileReader = new FileReader();
var inputTextArea = document.createElement('textarea');
inputTextArea.style.width = '400px';
inputTextArea.style.height = '500px';
inputTextArea.style.position = 'absolute';
inputTextArea.style.left = '50px';
inputTextArea.style.top = '50px';
inputTextArea.value = default_source;

var outputTextArea = document.createElement('textarea');
outputTextArea.id = 'output';
outputTextArea.style.width = '600px';
outputTextArea.style.height = '500px';
outputTextArea.style.position = 'absolute';
outputTextArea.style.left = '500px';
outputTextArea.style.top = '50px';

document.body.appendChild(inputTextArea);
document.body.appendChild(outputTextArea);

fileReader.onload = function(e) {
    inputTextArea.value = e.target.result;
};

var uploadButton = document.getElementById('uploadButton');
uploadButton.addEventListener('change', function(e) {
    var file = e.target.files[0];
    fileReader.readAsText(file);
});

var downloadButton = document.createElement('button');
downloadButton.innerHTML = 'Download';
downloadButton.style.position = 'absolute';
downloadButton.style.left = '1000px';
downloadButton.style.top = '580px';
document.body.appendChild(downloadButton);
downloadButton.addEventListener('click', function(e){
    var text = outputTextArea.value;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'result.obj';

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);

});

var assembleButton = document.createElement('button');
assembleButton.innerHTML = 'Assemble';
assembleButton.style.position = 'absolute';
assembleButton.style.left = '300px';
assembleButton.style.top = '580px';
document.body.appendChild(assembleButton);
assembleButton.addEventListener('click', function(e) {

    SYMTAB = {
        'A': 0x0,
        'X': 0x1,
        'L': 0x2,
        'B': 0x3,
        'S': 0x4,
        'T': 0x5,
        'F': 0x6,
        'PC': 0x8,
        'SW': 0x9,
    };
    starting_address = 0;
    program_length = 0;
    program_counters = [];
    program_counter = 0;
    base = 0;
    Mrecord = [];

    var source_program = inputTextArea.value;
    var intermediate_program = assemble_pass1(source_program);
    console.log('SYMTAB', SYMTAB);
    console.log('program_counters', program_counters);
    outputTextArea.value = assemble_pass2(intermediate_program);
    
});


/**
 * Change the toString method of an array.
 *
 * @param {array} array - The array to be modified toString.
 * @return {none} No return value.
 */
function modify_toString(array){
    array.toString = function(){
        return this.join('\t');
    }
}

function assemble_pass1(program){
    var lines = program.split('\n'), line, index = 0;
    var splitRegex = /[\t ]+/, byteRegex = /'[^']*'/;
    var LABEL, OPCODE, OPERAND, LOCCTR;
    var intermediate_code = '';

    // read first input line
    line = lines[index].split(splitRegex);
    OPCODE = line[1];
    OPERAND = line[2];

    // if OPCODE = 'START' then
    if (OPCODE === 'START') {
        // save #[OPERAND] as starting address
        starting_address = parseInt(OPERAND);

        // initialize LOCCTR to starting address
        LOCCTR = starting_address;
        program_counters.push(LOCCTR);

        // write line to intermediate file
        modify_toString(line);
        intermediate_code += line.toString() + '\n';

        // read next input line
        index++;
        line = lines[index].split(splitRegex);
        LABEL = line[0];
        OPCODE = line[1];
        OPERAND = line[2];
    }
    else{
        // initialize LOCCTR to 0
        LOCCTR = 0;
    }
    
    //while OPCODE != 'END' do
    while(OPCODE !== 'END'){
        if(LABEL in OPTAB){
            alert('Assemble Error: invalid label name: ' + LABEL + ' at line' + (index + 1) + '.');
            return null;
        }
        // if this is not a comment line then
        if(!(LABEL.startsWith('.') || OPCODE.startsWith('.'))){
            // if there is a symbol in the LABEL field then
            if(LABEL !== ''){
                // search SYMTAB for LABEL
                // if found then
                if(LABEL in SYMTAB){
                    // set error flag (duplicate symbol)
                    alert('Assemble Error: duplicate symbol: ' + LABEL + ' at line' + (index + 1) + '.');
                    return null;
                }
                // else
                else{
                    // insert (LABEL,LOCCTR) into SYMLAB
                    SYMTAB[LABEL] = LOCCTR;
                }
            }

            // search OPTAB for OPCODE
            // if found then
            if(OPCODE in OPTAB){
                // add 3 {instruction length} to LOCCTR
                LOCCTR += OPTAB[OPCODE].format;
            }
            else if(OPCODE.startsWith('+') && OPCODE.substring(1) in OPTAB && OPTAB[OPCODE.substring(1)].format === 3){
                LOCCTR += 4
            }
            // else if OPCODE='WORD' then
            else if(OPCODE === 'WORD'){
                // add 3 to LOCCTR
                LOCCTR += 3;
            }
            // else if OPCODE = 'RESW' then
            else if(OPCODE === 'RESW'){
                // add 3 * #[OPERAND] to LOCCTR
                LOCCTR += 3 * parseInt(OPERAND);
            }
            // else if OPCODE = 'RESB' then
            else if(OPCODE === 'RESB'){
                // add #[OPERAND] to LOCCTR
                LOCCTR += parseInt(OPERAND);
            }
            // else if OPCODE = 'BYTE' then
            else if(OPCODE === 'BYTE'){
                // find length of constant in bytes
                var length = OPERAND.match(byteRegex)[0].length - 2;
                if(OPERAND.startsWith('X')){
                    LOCCTR += length / 2;
                    // add length to LOCCTR
                }
                else if(OPERAND.startsWith('C')){
                    // add length to LOCCTR
                    LOCCTR += length;
                }
                else{
                    alert('Assemble Error: invalid BYTE label.' + OPERAND[0] + ' at line' + (index + 1) + '.');
                    return null;
                }
                
            }
            // else if BASE assemble instruction
            else if(OPCODE === 'BASE' || OPCODE === 'NOBASE'){
                
            }
            // else
            else{
                // set error flag (invalid operation code)
                alert('Assemble Error: invalid operation code: ' + OPCODE + ' at line' + (index + 1) + '.');
                return null;
            }

            program_counters.push(LOCCTR);
        }

        // write line to intermediate file
        modify_toString(line);
        intermediate_code += line.toString()  + '\n';

        // read next input line
        index++;
        line = lines[index].split(splitRegex);
        LABEL = line[0];
        OPCODE = line[1];
        OPERAND = line[2];
    }

    // write last line to intermediate file
    modify_toString(line);
    intermediate_code += line.toString();

    // save (LOCCTR – starting address) as program length
    program_length = LOCCTR - starting_address;
    
    return intermediate_code;
}

function assemble_pass2(program){
    var lines = program.split('\n'), line, index = 0;
    var splitRegex = /[\t ]+/, byteRegex = /'[^']*'/, numberRegex = /^\d+$/;
    var LABEL, OPCODE, OPERAND, mode = 'NOBASE';
    var object_program = '', object_code = '';
    var name = '';
    var operand_address;
    var Trecord;
    var current_address = starting_address;


    // read first input line
    line = lines[index].split(splitRegex);
    LABEL = line[0];
    OPCODE = line[1];
    OPERAND = lines[2];

    // if OPCODE = 'START' then
    if (OPCODE === 'START') {
        // write listing line
        name = LABEL.substring(0, 6);
        // read next input line
        index++;
        line = lines[index].split(splitRegex);
        LABEL = line[0];
        OPCODE = line[1];
        OPERAND = line[2];
    }

    // write Header record to object program
    object_program += 'H' + name + ' '.repeat(6 - name.length);
    var ca = current_address.toString(16).toUpperCase(), pl = program_length.toString(16).toUpperCase();
    object_program += '0'.repeat(6 - ca.length) + ca + '0'.repeat(6 - pl.length) + pl  + '\n';

    // initialize first Text record
    Trecord = 'T' + '0'.repeat(6-ca.length) + ca + '00';

    //while OPCODE != 'END' do
    while(OPCODE !== 'END'){
        // if this is not a comment line then
        if(!(LABEL.startsWith('.') || OPCODE.startsWith('.'))){
            object_code = '';
            // search OPTAB for OPCODE
            // if found then
            if(OPCODE in OPTAB || (OPCODE.startsWith('+') && OPCODE.substring(1) in OPTAB)){
                //if there is a symbol in the OPERAND field then
                if(OPERAND !== '' && OPERAND !== undefined){
                    // search SYMTAB for OPERAND
                    // if found then
                    if(OPERAND in SYMTAB){
                        // store symbol value as operand address
                        operand_address = SYMTAB[OPERAND];
                    }
                    else if((OPERAND.startsWith('#') || OPERAND.startsWith('@')) && OPERAND.substring(1) in SYMTAB){
                        operand_address = SYMTAB[OPERAND.substring(1)];
                    }
                    else if( OPERAND.startsWith('#') && numberRegex.test(OPERAND.substring(1)) ){
                        operand_address = 0;
                    }
                    else if(OPERAND.includes(',')){
                        var temp = OPERAND.split(',');
                        if(temp[0] in SYMTAB && temp.length === 2){
                            operand_address = SYMTAB[temp[0]];
                        }
                        else{
                            alert('Assemble Error: undefined symbol: ' + OPERAND + ' at line' + (index + 1) + '.');
                            return null;
                        }
                        
                    }
                    // else
                    else{
                        // store 0 as operand addresss
                        operand_address = 0;
                        // set error flag (undefined symbol)
                        alert('Assemble Error: undefined symbol: ' + OPERAND + ' at line' + (index + 1) + '.');
                        return null;
                    }
                }
                //else
                else{
                    // store 0 as operand address
                    operand_address = 0;
                }

                // assemble the object code instruction
                program_counter = program_counters[index];
                if( (object_code = assemble(OPCODE, OPERAND, operand_address, mode, index)) === null ){
                    return null;
                }
                console.log('object code: ', object_code);
            }
            // else if OPCODE ='BYTE' or 'WORD' then
            else if(OPCODE === 'BYTE' || OPCODE === 'WORD'){

                // convert constant to object code
                if(OPERAND.startsWith('X')){
                    OPERAND = OPERAND.match(byteRegex)[0];
                    OPERAND = OPERAND.substring(1, OPERAND.length - 1);
                    object_code = OPERAND;
                    console.log('object code: ', object_code);
                }
                else if(OPERAND.startsWith('C')){
                    OPERAND = OPERAND.match(byteRegex)[0];
                    OPERAND = OPERAND.substring(1, OPERAND.length - 1);
                    object_code = '';
                    for(let i = 0; i < OPERAND.length; i++){
                        object_code += OPERAND.charCodeAt(i).toString(16).toUpperCase();
                    }
                    console.log('object code: ', object_code);
                }
                
            }
            else if(OPCODE === 'BASE'){
                mode = 'BASE';
                base = SYMTAB[OPERAND];
                object_code = '';
            }
            else if(OPCODE === 'NOBASE'){
                mode = 'NOBASE';
                object_code = '';
            }

            // if object code will not fit into the current Text record
            if(Trecord.length + object_code.length > 69){
                // write Text record to object program
                Trecord = Trecord.substring(0, 7) + ((Trecord.length - 9) / 2).toString(16).toUpperCase() + Trecord.substring(9);
                object_program += Trecord + '\n';

                // initialize new Text record
                current_address = program_counters[index - 1];
                ca = current_address.toString(16).toUpperCase();
                Trecord = 'T' + '0'.repeat(6 - ca.length) + ca + '00';

            }

            // add object code to Text record
            Trecord += object_code;
            //console.log('Trecord', Trecord, "line: " + index + 1);

        }

        // write listing line
        
        // read next input line
        index++;
        line = lines[index].split(splitRegex);
        LABEL = line[0];
        OPCODE = line[1];
        OPERAND = line[2];
    }

    // write last Text record to object program
    var lastLen = ((Trecord.length - 9) / 2).toString(16).toUpperCase();
    Trecord = Trecord.substring(0, 7) + '0'.repeat(2 - lastLen.length) + lastLen + Trecord.substring(9);
    object_program += Trecord + '\n';

    // write Modify record to object program
    for(const record of Mrecord){
        var segment1 = record[0].toString(16).toUpperCase();
        var segment2 = record[1].toString(16).toUpperCase();
        object_program += 'M' + '0'.repeat(6 - segment1.length) + segment1 + '0'.repeat(2 - segment2.length) + segment2 + '\n';
    }

    // write End record to object program
    var segment = starting_address.toString(16).toUpperCase();
    var Erecord = 'E' + segment + '0'.repeat(6 - segment.length);
    object_program += Erecord + '\n';

    // write last listing line

    return object_program;
}

function assemble(OPCODE, OPERAND, operand_address, mode, index){
    var object_code = '';
    var n, i, x, b, p, e;
    
    // if format4
    if(OPCODE.startsWith('+')){
        OPCODE = OPCODE.substring(1);
        var address;
        //console.log('OPCODE: ', OPCODE, 'OPERAND: ', OPERAND);

        if(OPERAND === undefined){
            n = 1;
            i = 1;
            x = 0;
            b = 0;
            p = 0;
            e = 1;
            address = 0;
        }
        else if(OPERAND.startsWith('@')){
            n = 1;
            i = 1;
            if(OPERAND.includes(',')){
                x = 1;
            }
            else{
                x = 0;
            }
            b = 0;
            p = 0;
            e = 1;
            //console.log('operand_address: ', operand_address, 'PC: ', program_counter);
            address = SYMTAB[OPERAND];
            Mrecord.push([program_counters[index - 1] + 1, 5]);
        }
        else if(OPERAND.startsWith('#')){
            n = 0;
            i = 1;
            x = 0;
            
            e = 1;
            OPERAND = OPERAND.substring(1);

            if(OPERAND in SYMTAB){
                b = 0;
                p = 1;
                address = operand_address;
            }
            else{
                b = 0;
                p = 0;
                //console.log('OPERAND: ', parseInt(OPERAND));
                address = parseInt(OPERAND);
            }
        }
        else{

            n = 1;
            i = 1;
            if(OPERAND.includes(',')){
                x = 1;
            }
            else{
                x = 0;
            }
            b = 0;
            p = 0;
            e = 1;
            //console.log('operand_address: ', operand_address, 'PC: ', program_counter);
            address = SYMTAB[OPERAND];
            Mrecord.push([program_counters[index - 1] + 1, 5]);
        }

        var segment1 = ( OPTAB[OPCODE].code | (n << 1) | i ).toString(16).toUpperCase();
        var segment2 = ( (x << 3) | (b << 2) | (p << 1) | e ).toString(16).toUpperCase();
        var segment3 = address.toString(16).toUpperCase();
        object_code += '0'.repeat(2 - segment1.length) + segment1 + segment2 + '0'.repeat(5 - segment3.length) + segment3;
    }
    // else if format 3
    else if(OPTAB[OPCODE].format === 3){
        var disp;
        //console.log('OPCODE: ', OPCODE, 'OPERAND: ', OPERAND);

        if(OPERAND === undefined){
            n = 1;
            i = 1;
            x = 0;
            b = 0;
            p = 0;
            e = 0;
            disp = 0;
        }
        // Immediate addressing
        else if(OPERAND.startsWith('@')){
            n = 1;
            i = 0;
            x = 0;
            b = 0;
            p = 1;
            e = 0;
            OPERAND = OPERAND.substring(1);

            disp = operand_address - program_counter;

            if(disp > 2047 || disp < -2048){
                if(mode === 'BASE'){
                    b = 1;
                    p = 0;
                    disp = operand_address - base;
                    if(disp > 4095 || disp < 0){
                        console.log(disp);
                        alert('Assemble Error: invalid disp ' + disp + ' at line' + (index + 1) + '.');
                        return null;
                    }
                }
                else{
                    console.log(disp);
                    alert('Assemble Error: invalid disp ' + disp + ' at line' + (index + 1) + '.');
                    return null;
                }
            }
            else{
                if(disp < 0){
                    disp &= 0xFFF;
                }
            }
        }
        // Indirect addressing
        else if(OPERAND.startsWith('#')){
            n = 0;
            i = 1;
            x = 0;
            
            e = 0;
            OPERAND = OPERAND.substring(1);

            if(OPERAND in SYMTAB){
                b = 0;
                p = 1;
                disp = operand_address - program_counter;
            }
            else{
                b = 0;
                p = 0;
                //console.log('OPERAND: ', parseInt(OPERAND));
                disp = parseInt(OPERAND);
            }

        }
        // Simple addressing
        else{
            
            n = 1;
            i = 1;
            if(OPERAND.includes(',')){
                x = 1;
            }
            else{
                x = 0;
            }
            b = 0;
            p = 1;
            e = 0;
            //console.log('operand_address: ', operand_address, 'PC: ', program_counter);
            disp = operand_address - program_counter;

            if(disp > 2047 || disp < -2048){
                if(mode === 'BASE'){
                    b = 1;
                    p = 0;
                    disp = operand_address - base;
                    if(disp > 4095 || disp < 0){
                        alert('Assemble Error: invalid disp ' + disp + ' at line' + (index + 1) + '.');
                        return null;
                    }
                }
                else{
                    alert('Assemble Error: invalid disp ' + disp + ' at line' + (index + 1) + '.');
                    return null;
                }
            }
            else{
                if(disp < 0){
                    disp &= 0xFFF;
                }
            }
            
        }

        var segment1 = ( OPTAB[OPCODE].code | (n << 1) | i ).toString(16).toUpperCase();
        var segment2 = ( (x << 3) | (b << 2) | (p << 1) | e ).toString(16).toUpperCase();
        var segment3 = disp.toString(16).toUpperCase();
        object_code += '0'.repeat(2 - segment1.length) + segment1 + segment2 + '0'.repeat(3 - segment3.length) + segment3;

    }
    // else if format 2
    else if(OPTAB[OPCODE].format === 2){
        //console.log('OPCODE: ', OPCODE, 'OPERAND: ', OPERAND);

        var r1, r2;
        if(OPERAND.includes(',')){
            var temp = OPERAND.split(',');
            r1 = SYMTAB[temp[0]];
            r2 = SYMTAB[temp[1]];
        }
        else{
            r1 = SYMTAB[OPERAND];
            r2 = 0;
        }

        var segment = OPTAB[OPCODE].code.toString(16).toUpperCase();
        object_code += '0'.repeat(2 - segment.length) + segment + r1.toString(16) + r2.toString(16);
    }
    // format 1
    else{
        var segment = OPTAB[OPCODE].code.toString(16).toUpperCase();
        object_code += '0'.repeat(2 - segment.length) + segment;
    }

    return object_code;
}