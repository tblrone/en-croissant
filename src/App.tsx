import DatabaseView from "@/components/databases/DatabaseView";
import EnginesPage from "@/components/engines/EnginesPage";
import FilesPage from "@/components/files/FilesPage";
import HomePage from "@/components/home/HomePage";
import SettingsPage from "@/components/settings/SettingsPage";
import BoardsPage from "@/components/tabs/BoardsPage";
import {
  ActionIcon,
  Anchor,
  AppShell,
  Autocomplete,
  Button,
  Code,
  CopyButton,
  Group,
  Input,
  MantineProvider,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  localStorageColorSchemeManager,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { getVersion } from "@tauri-apps/api/app";
import { getMatches } from "@tauri-apps/api/cli";
import { ask, message, open } from "@tauri-apps/api/dialog";
import { open as shellOpen } from "@tauri-apps/api/shell";
import { appWindow } from "@tauri-apps/api/window";
import { useAtom, useAtomValue } from "jotai";
import { ContextMenuProvider } from "mantine-contextmenu";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import {
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  redirect,
  useNavigate,
  useRouteError,
} from "react-router-dom";
import { attachConsole, info } from "tauri-plugin-log-api";
import {
  activeTabAtom,
  fontSizeAtom,
  nativeBarAtom,
  pieceSetAtom,
  primaryColorAtom,
  spellCheckAtom,
  tabsAtom,
} from "./atoms/atoms";
import { SideBar } from "./components/Sidebar";
import DatabasesPage from "./components/databases/DatabasesPage";

import "@/styles/chessgroundBaseOverride.css";
import "@/styles/chessgroundColorsOverride.css";

import "@mantine/charts/styles.css";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";

import "mantine-contextmenu/styles.css";
import "mantine-datatable/styles.css";

import "@/styles/global.css";

import { listen } from "@tauri-apps/api/event";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";
import { useHotkeys } from "react-hotkeys-hook";
import { keyMapAtom } from "./atoms/keybinds";
import { commands } from "./bindings";
import AboutModal from "./components/About";
import TopBar from "./components/TopBar";
import { openFile } from "./utils/files";
import { createTab } from "./utils/tabs";

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme",
});

type MenuAction = {
  id?: string;
  label: string;
  shortcut?: string;
  action?: () => void;
};

type MenuGroup = {
  label: string;
  options: MenuAction[];
};

function RootLayout() {
  const isNative = useAtomValue(nativeBarAtom);
  const navigate = useNavigate();

  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);

  async function openNewFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PGN file", extensions: ["pgn"] }],
    });
    if (typeof selected === "string") {
      navigate("/");
      openFile(selected, setTabs, setActiveTab);
    }
  }

  function createNewTab() {
    navigate("/");
    createTab({
      tab: { name: "New Tab", type: "new" },
      setTabs,
      setActiveTab,
    });
  }

  async function checkForUpdates() {
    const res = await checkUpdate();
    if (res.shouldUpdate) {
      const yes = await ask("Do you want to install them now?", {
        title: "New version available",
      });
      if (yes) {
        await installUpdate();
      }
    } else {
      await message("No updates available");
    }
  }

  const [keyMap] = useAtom(keyMapAtom);

  useHotkeys(keyMap.NEW_TAB.keys, createNewTab);
  useHotkeys(keyMap.OPEN_FILE.keys, openNewFile);
  const [opened, setOpened] = useState(false);

  const menuActions: MenuGroup[] = [
    {
      label: "File",
      options: [
        {
          label: "New Tab",
          id: "new_tab",
          shortcut: keyMap.NEW_TAB.keys,
          action: createNewTab,
        },
        {
          label: "Open File",
          id: "open_file",
          shortcut: keyMap.OPEN_FILE.keys,
          action: openNewFile,
        },
        {
          label: "Exit",
          id: "exit",
          action: () => appWindow.close(),
        },
      ],
    },
    {
      label: "View",
      options: [
        {
          label: "Reload",
          id: "reload",
          shortcut: "Ctrl+R",
          action: () => location.reload(),
        },
      ],
    },
    {
      label: "Help",
      options: [
        {
          label: "Clear saved data",
          id: "clear_saved_data",
          action: () => {
            ask("Are you sure you want to clear all saved data?", {
              title: "Clear data",
            }).then((res) => {
              if (res) {
                localStorage.clear();
                sessionStorage.clear();
                location.reload();
              }
            });
          },
        },
        {
          label: "Open Logs",
          id: "logs",
          action: async () => {
            const appDataDirPath = await appDataDir();
            const path = await resolve(
              appDataDirPath,
              "logs",
              "en-croissant.log",
            );
            await shellOpen(path);
          },
        },
        { label: "divider" },
        {
          label: "Check for updates",
          id: "check_for_updates",
          action: checkForUpdates,
        },
        {
          label: "About",
          id: "about",
          action: () => setOpened(true),
        },
      ],
    },
  ];

  useEffect(() => {
    (async () => {
      const unlisten = await listen("tauri://menu", async ({ payload }) => {
        const action = menuActions
          .flatMap((group) => group.options)
          .find((action) => action.id === payload);
        if (action) {
          action.action?.();
        }
      });

      return () => {
        unlisten();
      };
    })();
  }, []);

  return (
    <AppShell
      navbar={{
        width: "3rem",
        breakpoint: 0,
      }}
      header={
        isNative
          ? undefined
          : {
              height: "2.5rem",
            }
      }
      styles={{
        main: {
          height: "100vh",
          userSelect: "none",
        },
      }}
    >
      <AboutModal opened={opened} setOpened={setOpened} />
      {!isNative && (
        <AppShell.Header>
          <TopBar menuActions={menuActions} />
        </AppShell.Header>
      )}
      <AppShell.Navbar>
        <SideBar />
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<RootLayout />} errorElement={<ErrorBoundary />}>
      <Route
        path="/"
        element={<BoardsPage />}
        errorElement={<ErrorBoundary />}
      />
      <Route
        path="accounts"
        element={<HomePage />}
        errorElement={<ErrorBoundary />}
      />
      <Route
        path="settings"
        element={<SettingsPage />}
        loader={async () => {
          return getVersion();
        }}
        errorElement={<ErrorBoundary />}
      />
      <Route
        path="files"
        element={<FilesPage />}
        errorElement={<ErrorBoundary />}
      />
      <Route
        path="databases"
        element={<DatabasesPage />}
        errorElement={<ErrorBoundary />}
        loader={async () => {
          const db = sessionStorage.getItem("database-view");
          if (db !== null && db !== "null") {
            return redirect("/databases/view");
          }
          return null;
        }}
      />

      <Route
        path="databases/view"
        element={<DatabaseView />}
        errorElement={<ErrorBoundary />}
      />
      <Route
        path="engines"
        element={<EnginesPage />}
        errorElement={<ErrorBoundary />}
      />
    </Route>,
  ),
);

function ErrorBoundary() {
  const error = useRouteError();

  return (
    <Stack p="md">
      <Title>An error ocurred</Title>
      {error instanceof Error && (
        <>
          <Text>
            <b>{error.name}:</b> {error.message}
          </Text>
          <Code>{error.stack}</Code>
          {error.cause}
        </>
      )}
      <Group>
        {error instanceof Error && (
          <CopyButton value={`${error.message}\n${error.stack}`}>
            {({ copied, copy }) => (
              <Button color={copied ? "teal" : undefined} onClick={copy}>
                {copied ? "Copied" : "Copy stack strace"}
              </Button>
            )}
          </CopyButton>
        )}
        <Button
          onClick={() =>
            router.navigate("/").then(() => window.location.reload())
          }
        >
          Reload
        </Button>
      </Group>

      <Text>
        Please report this on{" "}
        <Anchor
          href="https://github.com/franciscoBSalgueiro/en-croissant/issues/new?assignees=&labels=bug&projects=&template=bug.yml"
          target="_blank"
        >
          Github
        </Anchor>{" "}
        or on the{" "}
        <Anchor href="https://discord.com/invite/tdYzfDbSSW" target="_blank">
          Discord server
        </Anchor>
      </Text>
    </Stack>
  );
}

export default function App() {
  const primaryColor = useAtomValue(primaryColorAtom);
  const pieceSet = useAtomValue(pieceSetAtom);
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);
  const isNative = useAtomValue(nativeBarAtom);

  useEffect(() => {
    setTimeout(() => {
      commands.setMenuVisisble(isNative);
    }, 100);
  }, [isNative]);

  useEffect(() => {
    (async () => {
      await commands.closeSplashscreen();
      const detach = await attachConsole();
      info("React app started successfully");

      const matches = await getMatches();
      if (matches.args.file.occurrences > 0) {
        info(`Opening file from command line: ${matches.args.file.value}`);
        if (typeof matches.args.file.value === "string") {
          const file = matches.args.file.value;
          router.navigate("/", { replace: true });
          openFile(file, setTabs, setActiveTab);
        }
      }

      return () => {
        detach();
      };
    })();
  }, []);

  const fontSize = useAtomValue(fontSizeAtom);
  const spellCheck = useAtomValue(spellCheckAtom);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  return (
    <>
      <Helmet>
        <link rel="stylesheet" href={`/pieces/${pieceSet}.css`} />
      </Helmet>
      <MantineProvider
        colorSchemeManager={colorSchemeManager}
        defaultColorScheme="dark"
        theme={{
          primaryColor,
          components: {
            ActionIcon: ActionIcon.extend({
              defaultProps: {
                variant: "transparent",
                color: "gray",
              },
            }),
            TextInput: TextInput.extend({
              defaultProps: {
                spellCheck: spellCheck,
              },
            }),
            Autocomplete: Autocomplete.extend({
              defaultProps: {
                spellCheck: spellCheck,
              },
            }),
            Textarea: Textarea.extend({
              defaultProps: {
                spellCheck: spellCheck,
              },
            }),
            Input: Input.extend({
              defaultProps: {
                // @ts-ignore
                spellCheck: spellCheck,
              },
            }),
          },
          colors: {
            dark: [
              "#C1C2C5",
              "#A6A7AB",
              "#909296",
              "#5c5f66",
              "#373A40",
              "#2C2E33",
              "#25262b",
              "#1A1B1E",
              "#141517",
              "#101113",
            ],
          },
        }}
      >
        <ContextMenuProvider>
          <Notifications />
          <RouterProvider router={router} />
        </ContextMenuProvider>
      </MantineProvider>
    </>
  );
}
