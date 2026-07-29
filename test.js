const str = '\\leqm';
console.log(str.replace(/\\(leq|le|geq|ge|neq|ne|approx|in|subset|cup|cap|to|rightarrow)([a-zA-Z]+)/g, (m, c, l) => `[${c}][${l}]`));
