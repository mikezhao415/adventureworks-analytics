"""Read SQL Server through the existing container's sqlcmd, never a new server."""
import json
import os
import re
import subprocess
from decimal import Decimal

from src.contracts import TABLES, RELATIONSHIPS


class SourceError(RuntimeError):
    pass


def ident(value):
    return '.'.join('[' + part.replace(']', ']]') + ']' for part in value.split('.'))


def sqlcmd(sql, user, password, database='AdventureWorks2022', container=None):
    """Credentials travel over stdin, never argv or inherited Docker env flags."""
    container = container or os.environ.get('AW_CONTAINER')
    if not container or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', container):
        raise SourceError('Set AW_CONTAINER to the existing SQL Server container name')
    if '\n' in password or '\r' in password:
        raise SourceError('Credential contains an unsupported newline')
    command = ['docker', 'exec', '-i', container, 'sh', '-c',
               'IFS= read -r SQLCMDPASSWORD; export SQLCMDPASSWORD; '
               'exec /opt/mssql-tools18/bin/sqlcmd -S localhost -C -b -r 1 '
               '-y 0 -w 65535 -f 65001 -l 15 -t 180 '
               '-U "$1" -d "$2"', 'aw-extract', user, database]
    try:
        result = subprocess.run(command, input=(password + '\n' + sql).encode('utf-8'),
                                capture_output=True, timeout=600)
    except (OSError, subprocess.TimeoutExpired):
        raise SourceError('SQL Server transport failed or timed out; no snapshot published') from None
    if result.returncode:
        # Do not echo provider diagnostics: they can contain SQL or local secrets.
        raise SourceError('SQL Server command failed; verify connectivity, permissions and schema')
    try:
        return result.stdout.decode('utf-8')
    except UnicodeDecodeError:
        raise SourceError('SQL Server response is not valid UTF-8') from None


def source_sql():
    statements = ["SET NOCOUNT ON; SET XACT_ABORT ON; SET LOCK_TIMEOUT 30000;",
                  "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE; BEGIN TRANSACTION;",
                  "SELECT (SELECT 'source' AS kind, DB_NAME() AS database_name, "
                  "CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128)) AS server_version, "
                  "CONVERT(varchar(33),SYSUTCDATETIME(),126) AS started_utc "
                  "FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);"]
    for contract in TABLES:
        name = contract['name']
        # Strictly verify each selected source type, nullability, precision and scale.
        statements.append(
            "SELECT (SELECT 'schema' AS kind, '" + name + "' AS table_name, c.name, "
            "TYPE_NAME(c.system_type_id) AS base_type, c.precision, c.scale, c.is_nullable "
            "FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) FROM sys.columns c "
            "WHERE c.object_id=OBJECT_ID('" + name + "') ORDER BY c.column_id;")
        statements.append(
            "SELECT (SELECT 'count' AS kind, '" + name + "' AS table_name, "
            "q.row_count FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) FROM (SELECT COUNT_BIG(*) AS row_count FROM " + ident(name) + ') q;')
        columns = ','.join('t.' + ident(f.name) for f in contract['schema'])
        keys = ','.join('t.' + ident(k) for k in contract['keys'])
        statements.append(
            "SELECT (SELECT 'row' AS kind, '" + name + "' AS table_name, " + columns +
            ' FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER) FROM ' + ident(name) +
            ' t ORDER BY ' + keys + ';')
        pk = ','.join(ident(k) for k in contract['keys'])
        statements.append("SELECT (SELECT 'quality' AS kind, 'duplicate:" + name + "' AS metric, "
                          "q.violations FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) FROM "
                          "(SELECT COUNT_BIG(*) AS violations FROM (SELECT " + pk + " FROM " + ident(name) +
                          " GROUP BY " + pk + " HAVING COUNT_BIG(*)>1) duplicates) q;")
    for child, ck, parent, pk in RELATIONSHIPS:
        join = ' AND '.join('c.'+ident(a)+'=p.'+ident(b) for a,b in zip(ck,pk))
        present = ' AND '.join('c.'+ident(k)+' IS NOT NULL' for k in ck)
        statements.append("SELECT (SELECT 'quality' AS kind, 'orphan:"+child+'->'+parent+"' AS metric, "
                          "q.violations FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) FROM (SELECT COUNT_BIG(*) AS violations FROM " +
                          ident(child)+' c LEFT JOIN '+ident(parent)+' p ON '+join+' WHERE '+present+
                          ' AND p.'+ident(pk[0])+' IS NULL) q;')
    # Controls are computed by SQL Server independently of serialized row values.
    statements.extend([
        "SELECT (SELECT 'headers' AS kind, q.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) FROM (SELECT COUNT_BIG(*) AS orders, "
        "SUM(CAST(SubTotal AS decimal(38,4))) AS subtotal, "
        "SUM(CAST(TaxAmt AS decimal(38,4))) AS tax, SUM(CAST(Freight AS decimal(38,4))) AS freight, "
        "SUM(CAST(TotalDue AS decimal(38,4))) AS due, "
        "MIN(OrderDate) AS first_order,MAX(OrderDate) AS last_order FROM Sales.SalesOrderHeader) q;",
        "SELECT (SELECT 'lines' AS kind, q.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) FROM (SELECT COUNT_BIG(*) AS lines, SUM(CAST(OrderQty AS bigint)) AS units, "
        "SUM(LineTotal) AS line_total FROM Sales.SalesOrderDetail) q;",
        "SELECT (SELECT 'monthly' AS kind, q.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) FROM (SELECT CONVERT(char(7),OrderDate,126) AS month, Status AS status, "
        "COUNT_BIG(*) AS orders,SUM(CAST(SubTotal AS decimal(38,4))) AS subtotal, "
        "SUM(CAST(TaxAmt AS decimal(38,4))) AS tax,SUM(CAST(Freight AS decimal(38,4))) AS freight, "
        "SUM(CAST(TotalDue AS decimal(38,4))) AS due "
        "FROM Sales.SalesOrderHeader GROUP BY CONVERT(char(7),OrderDate,126),Status "
        ") q ORDER BY q.month,q.status;",
        "COMMIT TRANSACTION; SELECT '{\"kind\":\"complete\"}';"
    ])
    return '\n'.join(statements)


def read_records(user, password):
    raw = sqlcmd(source_sql(), user, password)
    try:
        records = [json.loads(line, parse_float=Decimal) for line in raw.splitlines() if line.strip()]
    except (ValueError, TypeError):
        raise SourceError('Invalid or truncated SQL Server response') from None
    if not records or records[-1] != {'kind': 'complete'}:
        raise SourceError('SQL Server transaction did not complete')
    return records
