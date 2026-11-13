"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  CollectionSummary,
  DatabaseStatus,
  DocumentPage,
  DocumentRecord,
  FieldDefinition,
  FieldValue,
} from "../../../shared/database";
import { databaseApi } from "@/lib/database-api";
import { CollectionDialog, fieldTypeLabels } from "./collection-dialog";
import { DocumentDialog } from "./document-dialog";
import { Dialog } from "./dialog";
import { Icon } from "./icon";

function displayValue(value: FieldValue | undefined, field: FieldDefinition) {
  if (value === null || value === undefined || value === "")
    return <span className="cell-empty">—</span>;
  if (typeof value === "boolean")
    return (
      <span className={`value-badge ${value ? "value-yes" : ""}`}>
        {value ? "Да" : "Нет"}
      </span>
    );
  if (field.type === "number" && typeof value === "number")
    return value.toLocaleString("ru-RU");
  if (field.type === "date" && typeof value === "string")
    return value.split("-").reverse().join(".");
  return String(value);
}

export function DatabaseStudio() {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [activeName, setActiveName] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    key: string;
    data?: DocumentPage;
    error?: string;
  } | null>(null);
  const [collectionDialog, setCollectionDialog] = useState<
    "new" | "edit" | null
  >(null);
  const [documentDialog, setDocumentDialog] = useState<
    DocumentRecord | "new" | null
  >(null);
  const [deleting, setDeleting] = useState<DocumentRecord | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const collection = collections.find((item) => item.name === activeName);
  const key = `${activeName}:${page}:${revision}`;
  const current = result?.key === key ? result : null;
  const loading = !!activeName && !current;

  useEffect(() => {
    let ignore = false;
    Promise.all([
      databaseApi<DatabaseStatus>("/health"),
      databaseApi<{ collections: CollectionSummary[] }>("/collections"),
    ])
      .then(([health, { collections: items }]) => {
        if (ignore) return;
        setStatus(health);
        setCollections(items);
        setConnectionError("");
        setActiveName((name) =>
          items.some((item) => item.name === name)
            ? name
            : (items[0]?.name ?? null),
        );
      })
      .catch((error: unknown) => {
        if (!ignore) {
          setStatus(null);
          setConnectionError(
            error instanceof Error ? error.message : "Нет подключения к базе.",
          );
        }
      });
    return () => {
      ignore = true;
    };
  }, [revision]);

  useEffect(() => {
    if (!activeName) return;
    let ignore = false;
    databaseApi<DocumentPage>(
      `/collections/${encodeURIComponent(activeName)}/documents?page=${page}&pageSize=15`,
    )
      .then((data) => {
        if (!ignore) setResult({ key, data });
      })
      .catch((error: unknown) => {
        if (!ignore)
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить записи.",
          });
      });
    return () => {
      ignore = true;
    };
  }, [activeName, page, revision, key]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4_000);
    return () => clearTimeout(timer);
  }, [notice]);

  const refresh = () => setRevision((value) => value + 1);
  function selectCollection(name: string) {
    setActiveName(name);
    setPage(1);
    setNotice("");
  }
  function savedCollection(name: string) {
    setCollectionDialog(null);
    selectCollection(name);
    setNotice(
      collectionDialog === "new"
        ? "Коллекция создана. Можно добавлять записи."
        : "Настройки коллекции сохранены.",
    );
    refresh();
  }
  async function deleteDocument() {
    if (!deleting || !collection) return;
    setDeletingBusy(true);
    setActionError("");
    try {
      await databaseApi(
        `/collections/${collection.name}/documents/${deleting.id}`,
        { method: "DELETE" },
      );
      setDeleting(null);
      if (current?.data?.items.length === 1 && page > 1) setPage(page - 1);
      setNotice("Запись удалена.");
      refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Не удалось удалить запись.",
      );
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div className="studio-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            f<span>.</span>
          </span>
          <span>
            vibe farpost<span className="brand-subtitle">DATA STUDIO</span>
          </span>
        </Link>
        <div className="workspace-card">
          <div className="workspace-icon">
            <Icon name="database" size={18} />
          </div>
          <div>
            <strong>Локальная база</strong>
            <span>{status?.database || "vibe_farpost"}</span>
          </div>
          <span className={`status-dot ${status ? "online" : ""}`} />
        </div>
        <div className="sidebar-section-title">
          <span>КОЛЛЕКЦИИ</span>
          <button
            className="sidebar-add"
            disabled={!status}
            aria-label="Создать коллекцию"
            onClick={() => setCollectionDialog("new")}
          >
            <Icon name="plus" size={17} />
          </button>
        </div>
        <nav className="collection-nav" aria-label="Коллекции">
          {collections.map((item) => (
            <button
              key={item.name}
              className={`collection-nav-item ${item.name === activeName ? "active" : ""}`}
              onClick={() => selectCollection(item.name)}
            >
              <Icon name="columns" size={17} />
              <span>{item.label}</span>
              <span className="nav-count">{item.count}</span>
            </button>
          ))}
          {!collections.length && (
            <p className="nav-empty">Здесь появятся ваши коллекции</p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-tag">
            <Icon name="server" size={15} />
            <span>На вашем компьютере</span>
          </div>
          <p>
            Данные сохраняются в MongoDB
            <br />и остаются после перезапуска.
          </p>
          <div className="sidebar-version">
            <span>Рабочее пространство</span>
            <span className="version-pill">LOCAL</span>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Рабочее пространство</span>
            <Icon name="chevron" size={13} />
            <strong>База данных</strong>
          </div>
          <div className={`connection-pill ${status ? "connected" : ""}`}>
            <span className={`status-dot ${status ? "online" : ""}`} />
            {status
              ? "MongoDB подключена"
              : connectionError
                ? "Нет подключения"
                : "Подключение…"}
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">ВАШИ ДАННЫЕ. ВАША СТРУКТУРА.</span>
              <h1>
                База данных<span className="heading-dot">.</span>
              </h1>
              <p>Создавайте коллекции и наполняйте их через удобные формы.</p>
            </div>
            <button
              className="button button-primary"
              disabled={!status}
              onClick={() => setCollectionDialog("new")}
            >
              <Icon name="plus" size={17} />
              Новая коллекция
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-icon">
                <Icon name="database" size={20} />
              </span>
              <div>
                <span className="stat-label">База данных</span>
                <strong className="database-name">
                  {status?.database || "vibe_farpost"}
                </strong>
              </div>
              <span className="stat-note">MongoDB</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                <Icon name="grid" size={20} />
              </span>
              <div>
                <span className="stat-label">Коллекции</span>
                <strong>{status?.collections ?? "—"}</strong>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                <Icon name="file" size={20} />
              </span>
              <div>
                <span className="stat-label">Записи</span>
                <strong>{status?.documents ?? "—"}</strong>
              </div>
              <span className="stat-note">всего в базе</span>
            </div>
          </div>

          {connectionError && (
            <div className="alert alert-error connection-error" role="alert">
              <div>
                <strong>Не удалось подключиться</strong>
                <p>{connectionError}</p>
              </div>
              <button className="button button-secondary" onClick={refresh}>
                <Icon name="refresh" size={16} />
                Повторить
              </button>
            </div>
          )}
          {notice && (
            <div className="alert alert-success" role="status">
              <Icon name="check" size={17} />
              {notice}
            </div>
          )}

          {collection ? (
            <section className="data-panel" aria-label={collection.label}>
              <div className="panel-heading">
                <div className="panel-title">
                  <span className="panel-icon">
                    <Icon name="columns" size={20} />
                  </span>
                  <div>
                    <h2>
                      {collection.label}
                      <span className="count-badge">
                        {current?.data?.total ?? collection.count}
                      </span>
                    </h2>
                    <p>{collection.description || collection.name}</p>
                  </div>
                </div>
                <div className="panel-actions">
                  <button
                    className="icon-button"
                    onClick={refresh}
                    aria-label="Обновить записи"
                  >
                    <Icon name="refresh" />
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={!status}
                    onClick={() => setCollectionDialog("edit")}
                  >
                    <Icon name="settings" size={16} />
                    Поля формы
                  </button>
                  <button
                    className="button button-primary"
                    disabled={!status}
                    onClick={() => setDocumentDialog("new")}
                  >
                    <Icon name="plus" size={16} />
                    Добавить запись
                  </button>
                </div>
              </div>
              <div className="collection-meta">
                <code>{collection.name}</code>
                <span>·</span>
                <span>{collection.fields.length} полей</span>
                <span>·</span>
                <span>Сначала новые</span>
              </div>
              {current?.error ? (
                <div className="panel-empty">
                  <Icon name="server" size={32} />
                  <h3>Не удалось загрузить записи</h3>
                  <p>{current.error}</p>
                  <button className="button button-secondary" onClick={refresh}>
                    Повторить
                  </button>
                </div>
              ) : loading ? (
                <div className="panel-empty" role="status">
                  <span className="loader" />
                  <p>Загружаем записи…</p>
                </div>
              ) : current?.data?.items.length ? (
                <>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th className="id-column">ID</th>
                          {collection.fields.map((field) => (
                            <th key={field.key}>
                              <span>{field.label}</span>
                              <small>{fieldTypeLabels[field.type]}</small>
                            </th>
                          ))}
                          <th>Добавлено</th>
                          <th>
                            <span className="sr-only">Действия</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.data.items.map((document) => (
                          <tr key={document.id}>
                            <td className="id-cell" title={document.id}>
                              {document.id.slice(-6)}
                            </td>
                            {collection.fields.map((field) => (
                              <td
                                key={field.key}
                                title={String(document.values[field.key] ?? "")}
                              >
                                {displayValue(
                                  document.values[field.key],
                                  field,
                                )}
                              </td>
                            ))}
                            <td className="date-cell">
                              {new Date(document.createdAt).toLocaleDateString(
                                "ru-RU",
                              )}
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="icon-button"
                                  aria-label={`Редактировать запись ${document.id.slice(-6)}`}
                                  onClick={() => setDocumentDialog(document)}
                                >
                                  <Icon name="edit" size={16} />
                                </button>
                                <button
                                  className="icon-button danger-hover"
                                  aria-label={`Удалить запись ${document.id.slice(-6)}`}
                                  onClick={() => {
                                    setActionError("");
                                    setDeleting(document);
                                  }}
                                >
                                  <Icon name="trash" size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination">
                    <span>
                      {(page - 1) * 15 + 1}–
                      {Math.min(page * 15, current.data.total)} из{" "}
                      {current.data.total} записей
                    </span>
                    <div>
                      <button
                        className="icon-button"
                        aria-label="Предыдущая страница"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        <Icon
                          name="chevron"
                          size={16}
                          style={{ transform: "rotate(180deg)" }}
                        />
                      </button>
                      <span>Страница {page}</span>
                      <button
                        className="icon-button"
                        aria-label="Следующая страница"
                        disabled={page * 15 >= current.data.total}
                        onClick={() => setPage(page + 1)}
                      >
                        <Icon name="chevron" size={16} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="panel-empty">
                  <span className="empty-small-icon">
                    <Icon name="file" size={30} />
                  </span>
                  <h3>Первая запись — начало истории</h3>
                  <p>
                    Форма уже настроена. Добавьте данные,
                    <br />и они появятся в этой таблице.
                  </p>
                  <button
                    className="button button-primary"
                    disabled={!status}
                    onClick={() => setDocumentDialog("new")}
                  >
                    <Icon name="plus" size={16} />
                    Добавить запись
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="onboarding-panel">
              <div className="empty-art" aria-hidden="true">
                <div className="art-card art-card-back" />
                <div className="art-card art-card-front">
                  <span className="art-icon">
                    <Icon name="database" size={31} />
                  </span>
                  <span className="art-line" />
                  <span className="art-line short" />
                  <span className="art-check">
                    <Icon name="check" size={14} />
                  </span>
                </div>
                <span className="art-spark spark-one">+</span>
                <span className="art-spark spark-two">+</span>
              </div>
              <span className="eyebrow">ГОТОВО К РАБОТЕ</span>
              <h2>
                {status
                  ? "Место для ваших будущих данных"
                  : connectionError
                    ? "Подключим вашу базу"
                    : "Готовим рабочее пространство"}
              </h2>
              <p>
                Начните с коллекции. Вы сами решаете, какие поля
                <br className="desktop-break" /> нужны — структуру можно
                дополнять по мере работы.
              </p>
              <button
                className="button button-primary"
                disabled={!status}
                onClick={() => setCollectionDialog("new")}
              >
                <Icon name="plus" size={17} />
                Создать первую коллекцию
              </button>
              <div className="setup-steps">
                <div>
                  <span>01</span>
                  <strong>Создайте коллекцию</strong>
                  <p>Для отдельного типа данных</p>
                </div>
                <Icon name="chevron" size={16} />
                <div>
                  <span>02</span>
                  <strong>Настройте поля</strong>
                  <p>Текст, числа, даты и ссылки</p>
                </div>
                <Icon name="chevron" size={16} />
                <div>
                  <span>03</span>
                  <strong>Заполняйте базу</strong>
                  <p>Через готовые формы</p>
                </div>
              </div>
            </section>
          )}
          <footer className="main-footer">
            <span>
              <span className="status-dot online" />
              Локальное рабочее пространство
            </span>
            <span>Структура растёт вместе с проектом</span>
          </footer>
        </main>
      </div>

      {collectionDialog && (
        <CollectionDialog
          collection={collectionDialog === "edit" ? collection : undefined}
          onClose={() => setCollectionDialog(null)}
          onSaved={savedCollection}
        />
      )}
      {documentDialog && collection && (
        <DocumentDialog
          collection={collection}
          document={documentDialog === "new" ? undefined : documentDialog}
          onClose={() => setDocumentDialog(null)}
          onSaved={() => {
            setDocumentDialog(null);
            setPage(1);
            setNotice("Запись сохранена в MongoDB.");
            refresh();
          }}
        />
      )}
      {deleting && (
        <Dialog
          title="Удалить запись?"
          subtitle="Запись будет удалена из MongoDB. Это действие нельзя отменить."
          onClose={() => {
            if (!deletingBusy) setDeleting(null);
          }}
        >
          <div className="form-body">
            <code className="delete-id">{deleting.id}</code>
            {actionError && (
              <div role="alert" className="alert alert-error">
                {actionError}
              </div>
            )}
          </div>
          <div className="dialog-footer">
            <button
              className="button button-secondary"
              onClick={() => setDeleting(null)}
              disabled={deletingBusy}
            >
              Отмена
            </button>
            <button
              className="button button-danger"
              onClick={() => void deleteDocument()}
              disabled={deletingBusy}
            >
              {deletingBusy ? "Удаление…" : "Удалить запись"}
              <Icon name="trash" size={16} />
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
