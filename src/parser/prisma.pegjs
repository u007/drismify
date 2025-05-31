{
  // Initializer block: code here runs once when the parser is generated.
  // We can define helper functions here if needed.

  // Helper function to process attribute arguments
  function processAttributeArgs(attributeName, rawArgs) {
    if (!rawArgs) return null;

    // Handle specific attribute types
    switch (attributeName) {
      case 'relation':
        return processRelationArgs(rawArgs);
      case 'index':
      case 'unique':
        return processIndexArgs(rawArgs);
      case 'default':
        return processDefaultArgs(rawArgs);
      case 'check':
        return processCheckArgs(rawArgs);
      default:
        return rawArgs;
    }
  }

  // Process @relation attribute arguments
  function processRelationArgs(rawArgs) {
    if (typeof rawArgs !== 'string' || rawArgs.trim() === '') return null;

    const relationArgs = {};
    let remainingString = rawArgs;

    const fieldsMatch = remainingString.match(/fields:\s*\[([^\]]*)\]/);
    if (fieldsMatch && fieldsMatch[1]) {
      relationArgs.fields = fieldsMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
      remainingString = remainingString.replace(fieldsMatch[0], '');
    }

    const referencesMatch = remainingString.match(/references:\s*\[([^\]]*)\]/);
    if (referencesMatch && referencesMatch[1]) {
      relationArgs.references = referencesMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
      remainingString = remainingString.replace(referencesMatch[0], '');
    }

    const nameMatch = remainingString.match(/name:\s*"([^"]*)"/);
    if (nameMatch && nameMatch[1]) {
      relationArgs.name = nameMatch[1];
      remainingString = remainingString.replace(nameMatch[0], '');
    }

    const onDeleteMatch = remainingString.match(/onDelete:\s*([A-Za-z]+)/);
    if (onDeleteMatch && onDeleteMatch[1]) {
      relationArgs.onDelete = onDeleteMatch[1];
      remainingString = remainingString.replace(onDeleteMatch[0], '');
    }

    const onUpdateMatch = remainingString.match(/onUpdate:\s*([A-Za-z]+)/);
    if (onUpdateMatch && onUpdateMatch[1]) {
      relationArgs.onUpdate = onUpdateMatch[1];
    }

    return Object.keys(relationArgs).length > 0 ? relationArgs : rawArgs;
  }

  // Process @index and @unique attribute arguments
  function processIndexArgs(rawArgs) {
    if (typeof rawArgs !== 'string' || rawArgs.trim() === '') return null;

    const indexArgs = {};
    let remainingString = rawArgs;

    const fieldsMatch = remainingString.match(/\[([^\]]*)\]/);
    if (fieldsMatch && fieldsMatch[1]) {
      indexArgs.fields = fieldsMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
      remainingString = remainingString.replace(fieldsMatch[0], '');
    }

    const nameMatch = remainingString.match(/name:\s*"([^"]*)"/);
    if (nameMatch && nameMatch[1]) {
      indexArgs.name = nameMatch[1];
      remainingString = remainingString.replace(nameMatch[0], '');
    }

    return Object.keys(indexArgs).length > 0 ? indexArgs : rawArgs;
  }

  // Process @default attribute arguments
  function processDefaultArgs(rawArgs) {
    if (typeof rawArgs === 'object' && rawArgs.function) {
      return rawArgs; // Return the function object as is
    }

    // Handle other default values
    return rawArgs;
  }

  // Process @@check attribute arguments
  function processCheckArgs(rawArgs) {
    if (typeof rawArgs !== 'string' || rawArgs.trim() === '') return null;

    const checkArgs = {};
    let remainingString = rawArgs;

    // Look for constraint expression (everything that's not a name parameter)
    const nameMatch = remainingString.match(/name:\s*"([^"]*)"/);
    if (nameMatch && nameMatch[1]) {
      checkArgs.name = nameMatch[1];
      remainingString = remainingString.replace(nameMatch[0], '').trim();
    }

    // Remove leading/trailing commas and whitespace
    remainingString = remainingString.replace(/^,\s*|,\s*$/g, '').trim();

    // The remaining string should be the constraint expression
    if (remainingString) {
      checkArgs.constraint = remainingString;
    }

    return Object.keys(checkArgs).length > 0 ? checkArgs : rawArgs;
  }
}

// Start rule: a schema can have multiple top-level blocks
Schema = _ elements:(Block / CommentLine)* _ {
  return elements.filter(e => e !== null && e.type !== 'comment');
}

Block = DatasourceBlock / GeneratorBlock / ModelBlock / EnumBlock / TypeBlock / ViewBlock

// Datasource Block
DatasourceBlock = _ "datasource" _ identifier:Identifier _ "{" _ assignments:Assignment* _ "}" _ {
  const block = { type: "datasource", name: identifier, assignments: {} };
  assignments.forEach(a => {
    if (a) block.assignments[a.key] = a.value;
  });
  return block;
}

// Generator Block
GeneratorBlock = _ "generator" _ identifier:Identifier _ "{" _ assignments:Assignment* _ "}" _ {
  const block = { type: "generator", name: identifier, assignments: {} };
  assignments.forEach(a => {
    if (a) block.assignments[a.key] = a.value;
  });
  return block;
}

// Model Block
ModelBlock = _ "model" _ modelName:Identifier _ "{" _ fields:Field* _ modelAttributes:ModelAttribute* _ "}" _ {
  return {
    type: "model",
    name: modelName,
    fields: fields.filter(f => f !== null),
    attributes: modelAttributes.filter(a => a !== null)
  };
}

// Model-level attributes like @@index, @@unique, etc.
ModelAttribute = _ "@@" attributeName:Identifier _ argumentsGroup:( "(" _ argValue:ParsedAttributeArgument? _ ")" )? _ {
  let finalArgs = null;
  if (argumentsGroup) {
    finalArgs = argumentsGroup[2]; // argValue is the result of ParsedAttributeArgument? at index 2
  }

  // Process arguments based on attribute type
  finalArgs = processAttributeArgs(attributeName, finalArgs);

  return {
    name: attributeName,
    args: finalArgs
  };
}

Field = _ fieldName:Identifier _ fieldType:FieldType _ attributes:FieldAttribute* _ {
  return { name: fieldName, type: fieldType, attributes: attributes };
}

FieldType = typeName:Identifier arrayMarker:"[]"? optionalMarker:"?"? {
  return {
    name: typeName,
    optional: optionalMarker === "?",
    isArray: arrayMarker === "[]"
  };
}

// Parse attribute name and arguments, using helper functions for structured parsing
FieldAttribute = _ "@" attributeName:Identifier _ argumentsGroup:( "(" _ argValue:ParsedAttributeArgument? _ ")" )? _ {
  let finalArgs = null;
  if (argumentsGroup) {
    finalArgs = argumentsGroup[2]; // argValue is the result of ParsedAttributeArgument? at index 2
  }

  // Process arguments based on attribute type
  finalArgs = processAttributeArgs(attributeName, finalArgs);

  // Handle attributes that typically don't have arguments
  if (argumentsGroup === undefined && (attributeName === "id" || attributeName === "unique" || attributeName === "updatedAt")) {
    finalArgs = null;
  }

  return {
    name: attributeName,
    args: finalArgs
  };
}

ParsedAttributeArgument = DefaultFunctionCall / BooleanLiteral / NumberLiteral / StringLiteral / RawArgumentContentString
// Identifier removed as a direct alternative; RawArgumentContentString will capture it.

DefaultFunctionCall
  = name:DefaultFunctionName _ "(" _ args:DefaultFunctionArgs? _ ")" {
      return {
        function: name,
        args: args || []
      };
    }

DefaultFunctionName
  = "autoincrement" / "now" / "uuid" / "cuid" / "dbgenerated" / "sequence" / "auto" / "nanoid"

DefaultFunctionArgs
  = StringLiteral
  / NumberLiteral
  / IdentifierList

// Enum Block
EnumBlock = _ "enum" _ enumName:Identifier _ "{" _ enumValues:EnumValueDefinition* _ "}" _ {
  return { type: "enum", name: enumName, values: enumValues.filter(v => v !== null) };
}

EnumValueDefinition = _ valueName:Identifier _ { return valueName; }
// This allows comments and whitespace around/between enum values.

// Type Block (for composite types)
TypeBlock = _ "type" _ typeName:Identifier _ "{" _ fields:Field* _ "}" _ {
  return { type: "type", name: typeName, fields: fields.filter(f => f !== null) };
}

// View Block (for database views)
ViewBlock = _ "view" _ viewName:Identifier _ "{" _ fields:Field* _ viewAttributes:ModelAttribute* _ "}" _ {
  return {
    type: "view",
    name: viewName,
    fields: fields.filter(f => f !== null),
    attributes: viewAttributes.filter(a => a !== null)
  };
}

// Rules for parsing content of @relation attribute arguments
RelationArgumentsListEntryPoint = _ args:RelationArgumentsList _ EOF { return args; } // For sub-parsing

RelationArgumentsList = first:NamedRelationArgument args:( _ "," _ next:NamedRelationArgument { return next; } )* {
  const result = {};
  result[first.name] = first.value;
  args.forEach(arg => {
    if (arg) result[arg.name] = arg.value;
  });
  return result;
}

NamedRelationArgument = argName:RelationArgumentName _ ":" _ argValue:RelationArgumentValue {
  return { name: argName, value: argValue };
}

RelationArgumentName = name:("fields" / "references" / "name" / "onDelete" / "onUpdate") { return name; }

RelationArgumentValue
  = IdentifierList
  / StringLiteral
  / RelationActionKeyword
  // Potentially add BooleanLiteral if any relation args take booleans

IdentifierList = "[" _ firstId:Identifier? restOfIds:( _ "," _ nextId:Identifier { return nextId; } )* _ "]" {
  if (firstId === null) { // Handles empty list like []
    return [];
  }
  const all = [firstId];
  restOfIds.forEach(id => all.push(id));
  return all;
}

RelationActionKeyword = kw:("Cascade" / "Restrict" / "SetNull" / "NoAction" / "SetDefault") { return kw; }
// End of @relation argument rules

// Captures raw content string if no specific argument type matches.
RawArgumentContentString = (AttributeArgumentChar)+ {
  return text(); // Revert to text() to see if it handles concatenation differently
}

AttributeArgumentChar
  = BalancedParens
  / BalancedBrackets
  / EscapedChar
  / NonDelimitersNonSlash

// Allow for balanced parentheses within arguments, e.g. function calls like autoincrement()
BalancedParens = "(" content:RawArgumentContentString? ")" { return "(" + (content !== null ? content : "") + ")"; }
// Allow for balanced square brackets within arguments, e.g. arrays like [id1, id2]
BalancedBrackets = "[" content:RawArgumentContentString? "]" { return "[" + (content !== null ? content : "") + "]"; }

// Handles characters that are not special delimiters for arguments or escape sequences
NonDelimitersNonSlash = char:(!("(" / ")" / "[" / "]" / "\\" / "//") .) { return char; }

// To allow capturing literal parentheses or brackets if ever needed (though not typical in Prisma args without being part of structure)
EscapedChar = "\\" escChar:. { return "\\" + escChar; } // Return the full escape sequence

// Assignment: key = value for datasource/generator
Assignment = _ key:Identifier _ "=" _ value:(EnvFunction / StringLiteral / BooleanLiteral / NumberLiteral) _ { // Allow more types for generator/datasource values
  return { key: key, value: value };
}

// Environment variable function
EnvFunction = "env" _ "(" _ varName:StringLiteral _ ")" {
  return `env("${varName}")`;
}

// Basic Tokens
Identifier "identifier" = [a-zA-Z_] [a-zA-Z0-9_]* { return text(); }

StringLiteral "string"
  = '"' chars:DoubleQuotedChar* '"' { return chars.join(""); }
  / "'" chars:SingleQuotedChar* "'" { return chars.join(""); }

DoubleQuotedChar = !('"' / "\\") char:. { return char; } / "\\" esc:EscapeSequence { return esc; }
SingleQuotedChar = !("'" / "\\") char:. { return char; } / "\\" esc:EscapeSequence { return esc; }

EscapeSequence
  = "n" { return "\n"; }
  / "r" { return "\r"; }
  / "t" { return "\t"; }
  / "b" { return "\b"; }
  / "f" { return "\f"; }
  / '"' { return '"'; }
  / "'" { return "'"; }
  / "\\" { return "\\"; }
  // Add more if needed, like unicode escapes

NumberLiteral "number"
  = float:(IntegerLiteral ("." [0-9]+)?) { return parseFloat(text()); }
  / float:("." [0-9]+) { return parseFloat(text()); }

IntegerLiteral = [0-9]+

BooleanLiteral "boolean"
  = "true" { return true; }
  / "false" { return false; }

// Whitespace and Comments
_ "whitespace" = (WhiteSpace / CommentLine)*
__ "mandatory_whitespace" = (WhiteSpace / CommentLine)+

WhiteSpace = [ \t\n\r]+
CommentLine = "//" [^\n]* ("\n" / EOF) { return { type: "comment", value: text() }; } // Consume newline or EOF

// End of File
EOF = !.
