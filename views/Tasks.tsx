return (
  <div className="p-4 md:p-10 max-w-full h-screen flex flex-col min-h-0">
    <style dangerouslySetInnerHTML={{ __html: `
      .sheets-style-table th {
        position: sticky !important;
        top: 0 !important;
        z-index: 30 !important;
        background-color: #f9fafb !important;
      }
      .dark .sheets-style-table th {
        background-color: #18181b !important;
      }
      .sheets-style-table th:first-child {
        left: 0 !important;
        z-index: 40 !important;
        box-shadow: 2px 0 4px rgba(0,0,0,0.05);
      }
    `}} />

    <PageHeader
      title="Client to do"
      description="Spreadsheet-style management. Double-click fields to edit. Manage multi-assignees instantly."
      actions={selectedClientId && (
        <div className="flex gap-2 w-full sm:w-auto">
          <Button icon={FileText} variant="outline" size="sm" onClick={() => setIsReportModalOpen(true)}>Report</Button>
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCsvImport} />
          <Button icon={FileUp} variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            Import csv
          </Button>
          <Button icon={Plus} size="sm" onClick={() => setIsCreateModalOpen(true)}>Add Task</Button>
        </div>
      )}
    />

    {/* EVERYTHING ABOVE TABLE */}
    <div className="flex-none min-h-0">
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <ToolbarItem label="Client selection">
          <Select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            <option value="">-- Choose brand partner --</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
          </Select>
        </ToolbarItem>

        {selectedClientId && (
          <>
            <ToolbarItem label="Live search">
              <Input
                placeholder="Filter project, who, area..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </ToolbarItem>

            <ToolbarItem label="Status Filter">
              <div className="flex gap-3">
                {(['Not Started', 'In Progress', 'Complete'] as StatusValue[]).map(status => (
                  <label key={status} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(status)}
                      onChange={() => handleToggleStatus(status)}
                    />
                    <span className="text-xs">{status}</span>
                  </label>
                ))}
              </div>
            </ToolbarItem>

            <ToolbarItem label="Sort order">
              <Select value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)}>
                <option value="dueDateSoonest">Due date (soonest)</option>
                <option value="dueDateLatest">Due date (latest)</option>
