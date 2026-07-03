import type { SqlDriver } from "@holy-padel/db";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { openAppDatabase } from "./database.ts";

interface DbStore {
  readonly driver: SqlDriver;
  readonly version: () => number;
  readonly subscribe: (listener: () => void) => () => void;
  /** Run a write against the database, then re-render every subscribed query. */
  readonly mutate: (write: (driver: SqlDriver) => void) => void;
}

const DbContext = createContext<DbStore | undefined>(undefined);

export function DbProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [driver, setDriver] = useState<SqlDriver | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void openAppDatabase().then((opened) => {
      if (!cancelled) {
        setDriver(opened);
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, []);

  const versionRef = useRef(0);
  const listenersRef = useRef(new Set<() => void>());

  const store = useMemo<DbStore | undefined>(
    () =>
      driver === undefined
        ? undefined
        : {
            driver,
            version: () => versionRef.current,
            subscribe: (listener: () => void) => {
              listenersRef.current.add(listener);
              return () => {
                listenersRef.current.delete(listener);
              };
            },
            mutate: (write: (target: SqlDriver) => void) => {
              write(driver);
              versionRef.current += 1;
              for (const listener of listenersRef.current) {
                listener();
              }
            },
          },
    [driver],
  );

  // Nothing renders until the database is open — the splash screen covers this.
  if (store === undefined) {
    return null;
  }
  return <DbContext.Provider value={store}>{children}</DbContext.Provider>;
}

function useDbStore(): DbStore {
  const store = useContext(DbContext);
  if (store === undefined) {
    throw new Error("useDb must be used inside DbProvider");
  }
  return store;
}

/** Re-runs `query` after every mutation; results are read synchronously. */
export function useDbQuery<T>(query: (driver: SqlDriver) => T): T {
  const store = useDbStore();
  const queryRef = useRef(query);
  queryRef.current = query;
  const cacheRef = useRef<{ version: number; value: T } | undefined>(undefined);
  return useSyncExternalStore(store.subscribe, () => {
    const version = store.version();
    if (cacheRef.current === undefined || cacheRef.current.version !== version) {
      cacheRef.current = { version, value: queryRef.current(store.driver) };
    }
    return cacheRef.current.value;
  });
}

/** The write half: `const mutate = useDbMutation(); mutate((db) => ...)`. */
export function useDbMutation(): (write: (driver: SqlDriver) => void) => void {
  const store = useDbStore();
  return useCallback(
    (write: (driver: SqlDriver) => void) => {
      store.mutate(write);
    },
    [store],
  );
}
