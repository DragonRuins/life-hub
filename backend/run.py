"""
Entry point for the Datacore backend.
Run with: python run.py
"""
from app import create_app

app = create_app()

if __name__ == '__main__':
    # host='0.0.0.0' makes it accessible from outside the container
    # debug=True enables hot-reload: save a file and Flask restarts automatically
    app.run(host='0.0.0.0', port=5000, debug=True)
