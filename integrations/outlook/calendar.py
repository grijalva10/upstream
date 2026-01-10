"""Calendar management module."""

from datetime import datetime, timedelta
from typing import List, Optional, Union, TYPE_CHECKING

from .constants import (
    FolderType, ItemType, BusyStatus, MeetingStatus, MeetingResponse,
    MeetingRecipientType, ResponseStatus, Sensitivity
)
from .exceptions import CalendarError, MeetingError, COMError
from .models import Appointment, Attendee
from .utils import pywintypes_to_datetime, safe_get_property, get_smtp_address, ensure_list

if TYPE_CHECKING:
    from .client import OutlookClient


class CalendarManager:
    """Manages calendar and meeting operations."""

    def __init__(self, client: "OutlookClient"):
        self._client = client

    def _get_calendar_folder(self):
        """Get the default calendar folder."""
        self._client._ensure_connected()
        return self._client.namespace.GetDefaultFolder(FolderType.CALENDAR)

    def create_appointment(
        self,
        subject: str,
        start: datetime,
        end: datetime,
        location: Optional[str] = None,
        body: Optional[str] = None,
        reminder_minutes: int = 15,
        all_day: bool = False,
        busy_status: BusyStatus = BusyStatus.BUSY,
        sensitivity: Sensitivity = Sensitivity.NORMAL
    ) -> Appointment:
        """
        Create a calendar appointment (not a meeting).

        Args:
            subject: Appointment subject
            start: Start datetime
            end: End datetime
            location: Location string
            body: Description/body text
            reminder_minutes: Minutes before to show reminder (0 to disable)
            all_day: If True, create an all-day event
            busy_status: Show as Free/Busy/Tentative/OOO
            sensitivity: Privacy level

        Returns:
            Appointment object
        """
        self._client._ensure_connected()

        try:
            appt = self._client.application.CreateItem(ItemType.APPOINTMENT)

            appt.Subject = subject
            appt.Start = start
            appt.End = end

            if location:
                appt.Location = location
            if body:
                appt.Body = body

            appt.AllDayEvent = all_day
            appt.BusyStatus = busy_status
            appt.Sensitivity = sensitivity

            if reminder_minutes > 0:
                appt.ReminderSet = True
                appt.ReminderMinutesBeforeStart = reminder_minutes
            else:
                appt.ReminderSet = False

            appt.Save()
            return self._parse_appointment(appt)

        except Exception as e:
            raise CalendarError(f"Failed to create appointment: {e}")

    def create_meeting(
        self,
        subject: str,
        start: datetime,
        end: datetime,
        attendees: Union[str, List[str]],
        location: Optional[str] = None,
        body: Optional[str] = None,
        optional_attendees: Union[str, List[str], None] = None,
        reminder_minutes: int = 15,
        all_day: bool = False,
        busy_status: BusyStatus = BusyStatus.BUSY,
        request_responses: bool = True,
        send_invites: bool = True
    ) -> Appointment:
        """
        Create a meeting with attendees.

        Args:
            subject: Meeting subject
            start: Start datetime
            end: End datetime
            attendees: Required attendee email(s)
            location: Meeting location
            body: Meeting description
            optional_attendees: Optional attendee email(s)
            reminder_minutes: Minutes before to show reminder
            all_day: If True, create an all-day meeting
            busy_status: Show as Free/Busy/Tentative/OOO
            request_responses: If True, request responses from attendees
            send_invites: If True, send meeting invites immediately

        Returns:
            Appointment object representing the meeting
        """
        self._client._ensure_connected()

        try:
            appt = self._client.application.CreateItem(ItemType.APPOINTMENT)

            appt.Subject = subject
            appt.Start = start
            appt.End = end
            appt.MeetingStatus = MeetingStatus.MEETING

            if location:
                appt.Location = location
            if body:
                appt.Body = body

            appt.AllDayEvent = all_day
            appt.BusyStatus = busy_status

            if reminder_minutes > 0:
                appt.ReminderSet = True
                appt.ReminderMinutesBeforeStart = reminder_minutes
            else:
                appt.ReminderSet = False

            appt.ResponseRequested = request_responses

            # Add required attendees
            for email in ensure_list(attendees):
                recipient = appt.Recipients.Add(email)
                recipient.Type = MeetingRecipientType.REQUIRED

            # Add optional attendees
            if optional_attendees:
                for email in ensure_list(optional_attendees):
                    recipient = appt.Recipients.Add(email)
                    recipient.Type = MeetingRecipientType.OPTIONAL

            # Resolve all recipients
            appt.Recipients.ResolveAll()

            if send_invites:
                appt.Send()
            else:
                appt.Save()

            return self._parse_appointment(appt)

        except Exception as e:
            raise MeetingError(f"Failed to create meeting: {e}")

    def get_appointments(
        self,
        start_date: datetime,
        end_date: datetime,
        include_recurring: bool = True
    ) -> List[Appointment]:
        """
        Get appointments within a date range.

        Args:
            start_date: Start of date range
            end_date: End of date range
            include_recurring: If True, expand recurring appointments

        Returns:
            List of Appointment objects
        """
        self._client._ensure_connected()

        try:
            calendar = self._get_calendar_folder()
            items = calendar.Items

            if include_recurring:
                items.IncludeRecurrences = True

            items.Sort("[Start]")

            # Format dates for Outlook filter
            start_str = start_date.strftime("%m/%d/%Y %H:%M %p")
            end_str = end_date.strftime("%m/%d/%Y %H:%M %p")

            restriction = f"[Start] >= '{start_str}' AND [End] <= '{end_str}'"
            filtered = items.Restrict(restriction)

            appointments = []
            for item in filtered:
                try:
                    appointments.append(self._parse_appointment(item))
                except Exception:
                    continue

            return appointments

        except Exception as e:
            raise CalendarError(f"Failed to get appointments: {e}")

    def get_today(self) -> List[Appointment]:
        """
        Get today's appointments.

        Returns:
            List of Appointment objects for today
        """
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        return self.get_appointments(today, tomorrow)

    def get_upcoming(self, days: int = 7) -> List[Appointment]:
        """
        Get upcoming appointments.

        Args:
            days: Number of days to look ahead

        Returns:
            List of upcoming Appointment objects
        """
        start = datetime.now()
        end = start + timedelta(days=days)
        return self.get_appointments(start, end)

    def respond_to_meeting(
        self,
        appointment: Appointment,
        response: MeetingResponse,
        send_response: bool = True
    ) -> None:
        """
        Respond to a meeting invitation.

        Args:
            appointment: The meeting to respond to
            response: Accept, Decline, or Tentative
            send_response: If True, send response to organizer
        """
        if not appointment._com_object:
            raise ValueError("Cannot respond - appointment has no COM reference")

        try:
            response_item = appointment._com_object.Respond(response, not send_response)
            if response_item and send_response:
                response_item.Send()
        except Exception as e:
            raise MeetingError(f"Failed to respond to meeting: {e}")

    def accept(self, appointment: Appointment, send_response: bool = True) -> None:
        """Accept a meeting invitation."""
        self.respond_to_meeting(appointment, MeetingResponse.ACCEPTED, send_response)

    def decline(self, appointment: Appointment, send_response: bool = True) -> None:
        """Decline a meeting invitation."""
        self.respond_to_meeting(appointment, MeetingResponse.DECLINED, send_response)

    def tentative(self, appointment: Appointment, send_response: bool = True) -> None:
        """Tentatively accept a meeting invitation."""
        self.respond_to_meeting(appointment, MeetingResponse.TENTATIVE, send_response)

    def cancel_meeting(
        self,
        appointment: Appointment,
        cancellation_message: Optional[str] = None
    ) -> None:
        """
        Cancel a meeting (must be the organizer).

        Args:
            appointment: The meeting to cancel
            cancellation_message: Optional message to include in cancellation
        """
        if not appointment._com_object:
            raise ValueError("Cannot cancel - appointment has no COM reference")

        try:
            appt = appointment._com_object
            appt.MeetingStatus = MeetingStatus.CANCELED

            if cancellation_message:
                appt.Body = cancellation_message + "\n\n" + appt.Body

            appt.Send()
        except Exception as e:
            raise MeetingError(f"Failed to cancel meeting: {e}")

    def delete(self, appointment: Appointment) -> None:
        """Delete an appointment or meeting."""
        if not appointment._com_object:
            raise ValueError("Cannot delete - appointment has no COM reference")

        try:
            appointment._com_object.Delete()
        except Exception as e:
            raise CalendarError(f"Failed to delete appointment: {e}")

    def update(
        self,
        appointment: Appointment,
        subject: Optional[str] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        location: Optional[str] = None,
        body: Optional[str] = None,
        send_update: bool = True
    ) -> Appointment:
        """
        Update an existing appointment or meeting.

        Args:
            appointment: Appointment to update
            subject: New subject (None to keep existing)
            start: New start time
            end: New end time
            location: New location
            body: New body/description
            send_update: If True and is a meeting, send update to attendees

        Returns:
            Updated Appointment object
        """
        if not appointment._com_object:
            raise ValueError("Cannot update - appointment has no COM reference")

        try:
            appt = appointment._com_object

            if subject is not None:
                appt.Subject = subject
            if start is not None:
                appt.Start = start
            if end is not None:
                appt.End = end
            if location is not None:
                appt.Location = location
            if body is not None:
                appt.Body = body

            if appointment.is_meeting and send_update:
                appt.Send()
            else:
                appt.Save()

            return self._parse_appointment(appt)

        except Exception as e:
            raise CalendarError(f"Failed to update appointment: {e}")

    def _parse_appointment(self, item) -> Appointment:
        """Parse a COM AppointmentItem into an Appointment object."""
        # Get attendees
        attendees = []
        required_str = ""
        optional_str = ""

        try:
            required_str = safe_get_property(item, "RequiredAttendees", "")
            optional_str = safe_get_property(item, "OptionalAttendees", "")

            for recip in item.Recipients:
                r_type = safe_get_property(recip, "Type", 1)
                response = safe_get_property(recip, "MeetingResponseStatus", 0)

                attendee = Attendee(
                    name=safe_get_property(recip, "Name", ""),
                    email=get_smtp_address(recip),
                    type=MeetingRecipientType(r_type) if r_type in [0, 1, 2, 3] else MeetingRecipientType.REQUIRED,
                    response_status=ResponseStatus(response) if response in range(6) else ResponseStatus.NONE
                )
                attendees.append(attendee)
        except Exception:
            pass

        meeting_status_val = safe_get_property(item, "MeetingStatus", 0)
        is_meeting = meeting_status_val != 0

        return Appointment(
            subject=safe_get_property(item, "Subject", ""),
            start=pywintypes_to_datetime(safe_get_property(item, "Start")),
            end=pywintypes_to_datetime(safe_get_property(item, "End")),
            location=safe_get_property(item, "Location", ""),
            body=safe_get_property(item, "Body", ""),
            html_body=safe_get_property(item, "HTMLBody", ""),
            is_all_day=safe_get_property(item, "AllDayEvent", False),
            is_meeting=is_meeting,
            is_recurring=safe_get_property(item, "IsRecurring", False),
            busy_status=BusyStatus(safe_get_property(item, "BusyStatus", 2)),
            meeting_status=MeetingStatus(meeting_status_val) if meeting_status_val in [0, 1, 3, 5, 7] else MeetingStatus.NON_MEETING,
            sensitivity=Sensitivity(safe_get_property(item, "Sensitivity", 0)),
            organizer=safe_get_property(item, "Organizer", ""),
            attendees=attendees,
            required_attendees=required_str,
            optional_attendees=optional_str,
            reminder_minutes=safe_get_property(item, "ReminderMinutesBeforeStart", 15),
            reminder_set=safe_get_property(item, "ReminderSet", True),
            entry_id=safe_get_property(item, "EntryID", None),
            _com_object=item
        )
