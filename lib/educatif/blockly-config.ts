// Configuration des blocs Blockly custom pour Code Cadet.
// Les blocs sont définis une fois et enregistrés dans le Blockly global.
// Le code généré n'est PAS du JS — on utilise un petit compilateur maison
// (voir compileWorkspaceToSteps) qui produit une liste d'opérations.

import type * as BlocklyType from 'blockly';

// Types d'étapes exécutables produites par le compilateur.
export type Step =
  | { op: 'say'; text: string }
  | { op: 'move' }
  | { op: 'turnRight' }
  | { op: 'turnLeft' };

export type CompileResult = {
  steps: Step[];
  blocksUsed: string[]; // types de blocs présents dans le workspace
  blockCount: number;
  errors: string[];
  hasStart: boolean;
};

// ============ DÉFINITION DES BLOCS ============
// Format : {type, message0, previousStatement, nextStatement, colour, args0}
// Ces définitions sont passées à Blockly.defineBlocksWithJsonArray().

export const BLOCK_DEFS = [
  // Événement de démarrage — block "hat" (pas de previousStatement).
  {
    type: 'event_start',
    message0: '⚡ Au début',
    nextStatement: null,
    colour: '#F59E0B',
    tooltip: 'Point de départ de ton programme. Tout ce qui est collé dessous s\'exécute dans l\'ordre.',
    helpUrl: '',
  },
  // Action : dire quelque chose
  {
    type: 'rex_say',
    message0: '💬 Dire %1',
    args0: [{ type: 'field_input', name: 'TEXT', text: 'Bonjour Rex!' }],
    previousStatement: null,
    nextStatement: null,
    colour: '#4ADE80',
    tooltip: 'Rex prononce la phrase.',
    helpUrl: '',
  },
  // Mouvement : avancer d'une case
  {
    type: 'rex_move_forward',
    message0: '🚶 Avancer d\'une case',
    previousStatement: null,
    nextStatement: null,
    colour: '#60A5FA',
    tooltip: 'Rex avance d\'une case dans la direction où il regarde.',
    helpUrl: '',
  },
  // Mouvement : tourner à droite
  {
    type: 'rex_turn_right',
    message0: '↻ Tourner à droite',
    previousStatement: null,
    nextStatement: null,
    colour: '#60A5FA',
    tooltip: 'Rex pivote de 90° vers la droite sans bouger.',
    helpUrl: '',
  },
  // Mouvement : tourner à gauche
  {
    type: 'rex_turn_left',
    message0: '↺ Tourner à gauche',
    previousStatement: null,
    nextStatement: null,
    colour: '#60A5FA',
    tooltip: 'Rex pivote de 90° vers la gauche sans bouger.',
    helpUrl: '',
  },
  // Boucle : répéter N fois
  {
    type: 'rex_repeat',
    message0: '🔁 Répéter %1 fois',
    args0: [{ type: 'field_number', name: 'TIMES', value: 3, min: 1, max: 20, precision: 1 }],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    colour: '#A855F7',
    tooltip: 'Exécute les blocs à l\'intérieur plusieurs fois.',
    helpUrl: '',
  },
];

// Enregistre les blocs dans l'instance Blockly fournie.
export function registerBlocks(Blockly: typeof BlocklyType) {
  try {
    Blockly.defineBlocksWithJsonArray(BLOCK_DEFS as any);
  } catch (e) {
    // Déjà défini (re-mount) — ignore
  }
}

// ============ TOOLBOX XML ============
// Construit le XML de toolbox à partir des catégories venues du backend.
export type ToolboxCategory = {
  name: string;
  colour: string;
  blocks: Array<{ type: string; params?: any }>;
};

export function buildToolboxXml(categories: ToolboxCategory[]): string {
  const cats = categories
    .map((c) => {
      const blocks = c.blocks
        .map((b) => {
          if (b.type === 'rex_repeat' && b.params?.times) {
            return `<block type="rex_repeat"><field name="TIMES">${Number(b.params.times) || 3}</field></block>`;
          }
          if (b.type === 'rex_say' && b.params?.text) {
            return `<block type="rex_say"><field name="TEXT">${escapeXml(String(b.params.text))}</field></block>`;
          }
          return `<block type="${b.type}"></block>`;
        })
        .join('\n');
      return `<category name="${escapeXml(c.name)}" colour="${c.colour}">${blocks}</category>`;
    })
    .join('\n');
  return `<xml>${cats}</xml>`;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============ COMPILATEUR ============
// Lit le workspace Blockly et produit une liste de Steps exécutables.
export function compileWorkspaceToSteps(
  Blockly: typeof BlocklyType,
  workspace: BlocklyType.WorkspaceSvg,
): CompileResult {
  const result: CompileResult = {
    steps: [],
    blocksUsed: [],
    blockCount: 0,
    errors: [],
    hasStart: false,
  };

  const allBlocks = workspace.getAllBlocks(false);
  result.blockCount = allBlocks.length;
  result.blocksUsed = Array.from(new Set(allBlocks.map((b: any) => b.type)));

  // Trouver le block event_start (il y en a 0 ou 1)
  const startBlocks = allBlocks.filter((b: any) => b.type === 'event_start');
  if (startBlocks.length === 0) {
    result.errors.push('Il manque le bloc orange « Au début ».');
    return result;
  }
  if (startBlocks.length > 1) {
    result.errors.push('Il ne peut y avoir qu\'un seul bloc « Au début ».');
  }
  result.hasStart = true;

  // Traverser la chaîne sous event_start
  const startBlock: any = startBlocks[0];
  traverseChain(startBlock.getNextBlock(), result.steps);

  return result;
}

function traverseChain(block: any, out: Step[]) {
  let current = block;
  while (current) {
    emitBlock(current, out);
    current = current.getNextBlock();
  }
}

function emitBlock(block: any, out: Step[]) {
  switch (block.type) {
    case 'rex_say':
      out.push({ op: 'say', text: block.getFieldValue('TEXT') || '' });
      break;
    case 'rex_move_forward':
      out.push({ op: 'move' });
      break;
    case 'rex_turn_right':
      out.push({ op: 'turnRight' });
      break;
    case 'rex_turn_left':
      out.push({ op: 'turnLeft' });
      break;
    case 'rex_repeat': {
      const times = Math.max(1, Math.min(50, Number(block.getFieldValue('TIMES')) || 1));
      const inner = block.getInputTargetBlock('DO');
      const innerSteps: Step[] = [];
      traverseChain(inner, innerSteps);
      for (let i = 0; i < times; i++) out.push(...innerSteps);
      break;
    }
    default:
      // Bloc inconnu → ignorer silencieusement
      break;
  }
}
