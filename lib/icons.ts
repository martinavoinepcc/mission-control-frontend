// Mapping central des icônes — FontAwesome Pro-style (free) uniquement.
// Les valeurs stockées en DB (app.icon) sont des slugs kebab-case.
// On les mappe ici pour éviter d'importer toute la lib côté client.

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faHouse,
  faRobot,
  faGraduationCap,
  faCompass,
  faCode,
  faCube,
  faCircleCheck,
  faXmark,
  faChevronRight,
  faRightFromBracket,
  faUserShield,
  faUser,
  faChildReaching,
  faPlus,
  faEye,
  faEyeSlash,
  faKey,
  faTrash,
  faArrowLeft,
  faCircleNotch,
  faShieldHalved,
  faBolt,
  faEnvelope,
  faLock,
} from '@fortawesome/free-solid-svg-icons';

// Map slug → icon. Pour ajouter une app : ajoute le slug ici et dans le seed.
export const APP_ICONS: Record<string, IconDefinition> = {
  'house': faHouse,
  'robot': faRobot,
  'graduation-cap': faGraduationCap,
  'code': faCode,
  'cube': faCube,
  'compass': faCompass,
};

// Fallback si le slug n'est pas mappé
export const DEFAULT_APP_ICON = faCube;

export function iconForApp(slug: string): IconDefinition {
  return APP_ICONS[slug] ?? DEFAULT_APP_ICON;
}

// Icônes UI réutilisables
export const UI = {
  check: faCircleCheck,
  close: faXmark,
  chevronRight: faChevronRight,
  logout: faRightFromBracket,
  admin: faUserShield,
  user: faUser,
  child: faChildReaching,
  plus: faPlus,
  eye: faEye,
  eyeSlash: faEyeSlash,
  key: faKey,
  trash: faTrash,
  back: faArrowLeft,
  spinner: faCircleNotch,
  shield: faShieldHalved,
  bolt: faBolt,
  envelope: faEnvelope,
  lock: faLock,
  compass: faCompass,
};
