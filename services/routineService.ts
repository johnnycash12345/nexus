
interface RoutineAction {
  name: string;
  args: any;
  timestamp: string;
}

const MAX_ACTIONS = 20;
const STORAGE_KEY = 'nexus_routine_actions';

/**
 * Logs a user action to localStorage for routine learning.
 * @param name The name of the action (e.g., 'open_app').
 * @param args The arguments for the action.
 */
export const logAction = (name: string, args: any): void => {
  try {
    const storedActions = localStorage.getItem(STORAGE_KEY);
    const actions: RoutineAction[] = storedActions ? JSON.parse(storedActions) : [];

    const newAction: RoutineAction = {
      name,
      args,
      timestamp: new Date().toISOString(),
    };

    actions.push(newAction);

    // Keep the log from growing indefinitely
    if (actions.length > MAX_ACTIONS) {
      actions.shift();
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch (error) {
    console.error("Failed to log routine action:", error);
  }
};

/**
 * Retrieves and formats the user's routine history to provide context to the AI.
 * @returns A string describing recent user actions, or an empty string if none.
 */
export const getRoutineContext = (): string => {
  try {
    const storedActions = localStorage.getItem(STORAGE_KEY);
    if (!storedActions) {
      return '';
    }

    const actions: RoutineAction[] = JSON.parse(storedActions);
    if (actions.length === 0) {
      return '';
    }
    
    const formattedActions = actions.map(action => {
        const time = new Date(action.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `- Às ${time}, a ação '${action.name}' foi executada com os seguintes detalhes: ${JSON.stringify(action.args)}.`;
    }).slice(-5); // Use the last 5 actions for context

    return `Para referência, aqui estão algumas das ações mais recentes do usuário:\n${formattedActions.join('\n')}`;

  } catch (error) {
    console.error("Failed to get routine context:", error);
    return '';
  }
};
