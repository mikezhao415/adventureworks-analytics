"""Explicit one-time provisioning in the existing container; never part of extraction.

Creates only a dedicated login/user and table SELECT grants. Writes a new ignored
.env. Uses the container's existing MSSQL_SA_PASSWORD without returning it to host.
"""
import argparse
import os
from pathlib import Path
import re
import secrets
import subprocess

from src.contracts import TABLES
from src.sql_source import ident


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--container', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', args.container):
        parser.error('Invalid container name')
    path = Path('.env')
    descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    password = 'Aw4!' + secrets.token_urlsafe(36)
    user = 'aw_snapshot_reader'
    sql = "SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;\n"
    sql += "IF SUSER_ID('aw_snapshot_reader') IS NOT NULL THROW 50001, 'Reader already exists; no changes made', 1;\n"
    sql += f"CREATE LOGIN [{user}] WITH PASSWORD='{password}', CHECK_POLICY=ON;\n"
    sql += f"USE AdventureWorks2022; CREATE USER [{user}] FOR LOGIN [{user}];\n"
    sql += '\n'.join(f'GRANT SELECT ON OBJECT::{ident(t["name"])} TO [{user}];' for t in TABLES)
    sql += '\nCOMMIT TRANSACTION;'
    try:
        result = subprocess.run(['docker','exec','-i',args.container,'sh','-c',
            'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" exec /opt/mssql-tools18/bin/sqlcmd '
            '-S localhost -U sa -C -b -r 1 -l 15 -t 30'],
            input=sql, encoding='utf-8', capture_output=True, timeout=60)
        if result.returncode:
            raise RuntimeError('Reader provisioning failed')
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            descriptor = None
            stream.write(f'AW_CONTAINER={args.container}\nAW_SQL_USER={user}\nAW_SQL_PASSWORD={password}\n')
            stream.flush()
            os.fsync(stream.fileno())
        print('Created dedicated reader with nine table SELECT grants; credentials saved in ignored .env')
    except Exception:
        if descriptor is not None:
            os.close(descriptor)
        # Keep the reservation marker if outcome is uncertain; never rotate blindly.
        raise RuntimeError('Provisioning did not finish; inspect account state and .env before retrying') from None


if __name__ == '__main__':
    main()
